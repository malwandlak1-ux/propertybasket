<?php

namespace App\Http\Controllers\Landlord;

use App\Http\Controllers\Landlord\Concerns\ResolvesLandlord;
use App\Models\Landlord;
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

    /**
     * GET /landlord/finance[?property={listing}&range=3|6|12|lease] — every
     * figure on the page follows the property + period filters.
     */
    public function index(Request $request): Response
    {
        $landlord = $this->resolveLandlord($request);
        $now      = CarbonImmutable::now();
        $period   = $now->format('Y-m');

        [$listingId, $range] = $this->filters($request, $landlord);
        [$from, $to] = $this->statements->period($landlord, $range, $listingId);

        $listingIds = $landlord->listings()->where('listing_type', 'long_term_rent')
            ->when($listingId, fn ($q) => $q->whereKey($listingId))
            ->pluck('id');
        $leaseIds = Lease::whereIn('listing_id', $listingIds)->where('status', 'active')->pluck('id');

        // ── KPIs (current position for the selected property / portfolio) ─
        $monthlyRentRoll = Lease::whereIn('id', $leaseIds)->sum('monthly_rent');

        $thisMonthCollected = RentPayment::whereIn('lease_id', $leaseIds)
            ->where('period_month', $period)
            ->whereNotNull('paid_at')
            ->sum('amount');

        $outstanding = RentPayment::whereIn('lease_id', $leaseIds)
            ->whereNull('paid_at')
            ->where('due_date', '<=', $now)
            ->sum('amount');

        // ── Income statement for the selected period (cash basis) ──────────
        $summary   = $this->statements->build($landlord, $from, $to, $listingId);
        $netMargin = $summary['income'] > 0 ? round(($summary['net'] / $summary['income']) * 100, 1) : 0.0;
        $maintPct  = $summary['income'] > 0 ? round(($summary['maintenance'] / $summary['income']) * 100, 1) : 0.0;

        // ── Cash flow: each month in the period, income vs maintenance ─────
        $entries = $this->statements->entries($landlord, $listingId);
        $cashflow = [];
        for ($mo = $from->startOfMonth(); $mo->lte($now->startOfMonth()); $mo = $mo->addMonth()) {
            $in = $entries->filter(fn ($e) => $e['date']->isSameMonth($mo));
            $cashflow[] = [
                'month'       => $mo->format($from->diffInMonths($now) > 11 ? 'M y' : 'M'),
                'period'      => $mo->format('Y-m'),
                'income'      => round((float) $in->sum('income'), 2),
                'maintenance' => round((float) $in->sum('expense'), 2),
            ];
        }

        // ── Rent charges in the period ────────────────────────────────────
        $payments = RentPayment::whereIn('lease_id', Lease::whereIn('listing_id', $listingIds)->pluck('id'))
            ->whereDate('due_date', '>=', $from->toDateString())
            ->whereDate('due_date', '<=', $to->toDateString())
            ->with(['lease.listing', 'lease.tenant'])
            ->orderByDesc('due_date')
            ->limit(60)
            ->get()
            ->map(fn ($p) => [
                'id'        => $p->id,
                'period'    => $p->period_month,
                'amount'    => (float) $p->amount,
                'due_date'  => $p->due_date->format('d M Y'),
                'paid_at'   => $p->paid_at?->format('d M Y'),
                'status'    => $p->paid_at ? 'paid' : ($p->due_date->isPast() ? 'overdue' : 'pending'),
                'property'  => $p->lease?->listing?->address ?: $p->lease?->listing?->suburb,
                'tenant'    => $p->lease?->tenant?->name,
                'method'    => $p->payment_method ?? 'eft',
                'reference' => $p->paystack_reference,
            ])
            ->values()
            ->all();

        // ── Maintenance paid in the period ────────────────────────────────
        $maintenance = collect($summary['lines'])->where('type', 'maintenance')
            ->sortByDesc(fn ($e) => $e['date']->format('YmdHis'))->take(20)
            ->map(fn ($e) => [
                'date'        => $e['date']->format('d M Y'),
                'description' => $e['description'],
                'property'    => $e['property'],
                'reference'   => $e['reference'],
                'amount'      => $e['expense'],
            ])->values()->all();

        $trend = array_map(fn ($c) => ['label' => $c['month'], 'period' => $c['period'], 'collected' => $c['income']], $cashflow);

        $properties = $landlord->listings()->orderBy('id')->get(['id', 'title', 'address'])
            ->map(fn ($l) => ['id' => $l->id, 'name' => $l->address ?: $l->title])->values();

        return Inertia::render('Landlord/Finance', [
            'landlord'   => ['id' => $landlord->id, 'name' => $request->user()->name],
            'year'       => (int) $now->format('Y'),
            'filters'    => [
                'property'    => $listingId,
                'range'       => $range,
                'range_label' => LandlordStatementService::RANGE_LABELS[$range],
                'from'        => $from->format('d M Y'),
                'to'          => $to->format('d M Y'),
            ],
            'properties' => $properties,
            'ranges'     => collect(LandlordStatementService::RANGE_LABELS)->map(fn ($label, $key) => ['key' => (string) $key, 'label' => $label])->values(),
            'kpis'       => [
                'monthly_roll'         => (float) $monthlyRentRoll,
                'ytd_collected'        => $summary['income'],
                'this_month_collected' => (float) $thisMonthCollected,
                'outstanding'          => (float) $outstanding,
            ],
            'income_statement' => [
                'rent_income'     => $summary['income'],
                'maintenance'     => $summary['maintenance'],
                'net'             => $summary['net'],
                'net_margin_pct'  => $netMargin,
                'maintenance_pct' => $maintPct,
            ],
            'cashflow'    => $cashflow,
            'by_property' => $summary['by_property'],
            'statements'  => $this->statements->availableMonths($landlord, $listingId, $from),
            'eft_pending' => \App\Models\EftPayment::where('status', 'submitted')
                ->whereHas('lease', fn ($q) => $q->whereIn('listing_id', $landlord->listings()->pluck('id')))
                ->with(['tenant:id,name', 'lease.listing:id,title,address', 'rentPayment:id,period_month,amount'])
                ->orderBy('paid_on')
                ->get()
                ->map(fn ($e) => [
                    'id'        => $e->id,
                    'tenant'    => $e->tenant?->name,
                    'property'  => $e->lease?->listing?->address ?: $e->lease?->listing?->title,
                    'period'    => $e->rentPayment ? CarbonImmutable::parse($e->rentPayment->period_month . '-01')->format('F Y') : null,
                    'due'       => (float) ($e->rentPayment?->amount ?? 0),
                    'amount'    => (float) $e->amount,
                    'paid_on'   => $e->paid_on->format('d M Y'),
                    'reference' => $e->reference,
                    'note'      => $e->note,
                    'has_proof' => (bool) $e->proof_path,
                ])->values(),
            'payments'    => $payments,
            'maintenance' => $maintenance,
            'trend'       => $trend,
        ]);
    }

    /**
     * GET /landlord/finance/statement.pdf — owner statement: rent received
     * less maintenance. ?month=YYYY-MM for one month, else ?range=3|6|12|lease
     * (default: full lease period). ?property={listing} limits it to one
     * property.
     */
    public function statement(Request $request, PdfService $pdf)
    {
        $landlord = $this->resolveLandlord($request);
        [$listingId, $range] = $this->filters($request, $landlord, default: 'lease');

        $month = $request->query('month');
        if ($month !== null) {
            abort_unless(is_string($month) && preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month), 404);
            $first = $this->statements->firstMonth($landlord, $listingId)->format('Y-m');
            abort_if($month < $first || $month > CarbonImmutable::now()->format('Y-m'), 404);
        }

        return $pdf->landlordStatement($landlord, $month, download: $request->boolean('download'), listingId: $listingId, range: $range);
    }

    /**
     * Validated filters: a property that belongs to this landlord (else 404)
     * and a known period.
     *
     * @return array{0: ?int, 1: string}
     */
    private function filters(Request $request, Landlord $landlord, string $default = '12'): array
    {
        $listingId = null;
        if ($request->filled('property')) {
            $listing = $this->statements->ownedListing($landlord, (int) $request->query('property'));
            abort_if($listing === null, 404);
            $listingId = $listing->id;
        }

        $range = (string) $request->query('range', $default);
        if (! in_array($range, LandlordStatementService::RANGES, true)) {
            $range = $default;
        }

        return [$listingId, $range];
    }
}
