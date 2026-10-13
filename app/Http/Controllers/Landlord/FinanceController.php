<?php

namespace App\Http\Controllers\Landlord;

use App\Http\Controllers\Landlord\Concerns\ResolvesLandlord;
use App\Models\Lease;
use App\Models\RentPayment;
use App\Services\LandlordStatementService;
use App\Services\PdfService;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Inertia\Inertia;
use Inertia\Response;

class FinanceController extends Controller
{
    use ResolvesLandlord;

    public function __construct(private readonly LandlordStatementService $statements) {}

    public function index(Request $request): Response
    {
        $landlord   = $this->resolveLandlord($request);
        $now        = CarbonImmutable::now();
        $period     = $now->format('Y-m');
        $yearStart  = $now->startOfYear();

        $listingIds = $landlord->listings()->where('listing_type', 'long_term_rent')->pluck('id');
        $leaseIds   = Lease::whereIn('listing_id', $listingIds)->where('status', 'active')->pluck('id');

        // ── KPIs ──────────────────────────────────────────────────────────
        $monthlyRentRoll = Lease::whereIn('id', $leaseIds)->sum('monthly_rent');

        $thisMonthCollected = RentPayment::whereIn('lease_id', $leaseIds)
            ->where('period_month', $period)
            ->whereNotNull('paid_at')
            ->sum('amount');

        $outstanding = RentPayment::whereIn('lease_id', $leaseIds)
            ->whereNull('paid_at')
            ->where('due_date', '<=', $now)
            ->sum('amount');

        // ── Income statement (cash basis: rent received − maintenance paid) ─
        $ytd = $this->statements->build($landlord, $yearStart, $now->endOfDay());
        $netMargin = $ytd['income'] > 0 ? round(($ytd['net'] / $ytd['income']) * 100, 1) : 0.0;
        $maintPct  = $ytd['income'] > 0 ? round(($ytd['maintenance'] / $ytd['income']) * 100, 1) : 0.0;

        // ── Cash flow: last 6 months, income vs maintenance ────────────────
        $entries = $this->statements->entries($landlord);
        $cashflow = [];
        for ($i = 5; $i >= 0; $i--) {
            $mo = $now->startOfMonth()->subMonths($i);
            $in = $entries->filter(fn ($e) => $e['date']->isSameMonth($mo));
            $cashflow[] = [
                'month'       => $mo->format('M'),
                'period'      => $mo->format('Y-m'),
                'income'      => round((float) $in->sum('income'), 2),
                'maintenance' => round((float) $in->sum('expense'), 2),
            ];
        }

        // ── Payment history ───────────────────────────────────────────────
        $payments = RentPayment::whereIn('lease_id', $leaseIds)
            ->with(['lease.listing', 'lease.tenant'])
            ->orderByDesc('due_date')
            ->limit(36)
            ->get()
            ->map(function ($p) {
                return [
                    'id'           => $p->id,
                    'period'       => $p->period_month,
                    'amount'       => (float) $p->amount,
                    'due_date'     => $p->due_date->format('d M Y'),
                    'paid_at'      => $p->paid_at?->format('d M Y'),
                    'status'       => $p->paid_at ? 'paid' : ($p->due_date->isPast() ? 'overdue' : 'pending'),
                    'property'     => $p->lease?->listing?->suburb,
                    'tenant'       => $p->lease?->tenant?->name,
                    'method'       => $p->payment_method ?? 'eft',
                    'reference'    => $p->paystack_reference,
                ];
            })
            ->values()
            ->all();

        // ── Maintenance paid (expenses) ───────────────────────────────────
        $maintenance = $entries->where('type', 'maintenance')->sortByDesc(fn ($e) => $e['date']->format('YmdHis'))->take(20)
            ->map(fn ($e) => [
                'date'        => $e['date']->format('d M Y'),
                'description' => $e['description'],
                'property'    => $e['property'],
                'reference'   => $e['reference'],
                'amount'      => $e['expense'],
            ])->values()->all();

        // ── Monthly trend (last 6 months) — kept for compatibility ─────────
        $trend = array_map(fn ($c) => ['label' => $c['month'], 'period' => $c['period'], 'collected' => $c['income']], $cashflow);

        return Inertia::render('Landlord/Finance', [
            'landlord'   => ['id' => $landlord->id, 'name' => $request->user()->name],
            'year'       => (int) $now->format('Y'),
            'kpis'       => [
                'monthly_roll'         => (float) $monthlyRentRoll,
                'ytd_collected'        => $ytd['income'],
                'this_month_collected' => (float) $thisMonthCollected,
                'outstanding'          => (float) $outstanding,
            ],
            'income_statement' => [
                'rent_income'     => $ytd['income'],
                'maintenance'     => $ytd['maintenance'],
                'net'             => $ytd['net'],
                'net_margin_pct'  => $netMargin,
                'maintenance_pct' => $maintPct,
            ],
            'cashflow'    => $cashflow,
            'by_property' => $ytd['by_property'],
            'statements'  => $this->statements->availableMonths($landlord),
            'payments'    => $payments,
            'maintenance' => $maintenance,
            'trend'       => $trend,
        ]);
    }

    /**
     * GET /landlord/finance/statement.pdf[?month=YYYY-MM] — owner statement:
     * rent received less maintenance, full history or one month.
     */
    public function statement(Request $request, PdfService $pdf)
    {
        $landlord = $this->resolveLandlord($request);

        $month = $request->query('month');
        if ($month !== null) {
            abort_unless(is_string($month) && preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month), 404);
            $first = $this->statements->firstMonth($landlord)->format('Y-m');
            abort_if($month < $first || $month > CarbonImmutable::now()->format('Y-m'), 404);
        }

        return $pdf->landlordStatement($landlord, $month, download: $request->boolean('download'));
    }
}
