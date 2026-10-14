<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Tenant\Concerns\ResolvesTenant;
use App\Models\Lease;
use App\Models\RentPayment;
use App\Services\LeaseBillingService;
use App\Services\PdfService;
use App\Services\TenantStatementService;
use App\Support\StatementRange;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PaymentsController extends Controller
{
    use ResolvesTenant;

    public function __construct(private readonly LeaseBillingService $billing) {}

    public function index(Request $request): Response
    {
        $lease = $this->resolveLease($request);
        $user  = $request->user();
        $now   = CarbonImmutable::now();

        // Raise any missing monthly charges + flip past-due to overdue.
        $this->billing->ensureCharges($lease);

        // Payments due now (hero, "Pay now", outstanding) always follow the
        // current lease; history, totals and statements follow the filters.
        $payments = RentPayment::where('lease_id', $lease->id)
            ->orderByDesc('due_date')
            ->get();

        [$selected, $range] = $this->filters($request, $lease);
        if ($selected->id !== $lease->id) {
            $this->billing->ensureCharges($selected);
        }
        [$from, $to] = app(TenantStatementService::class)->period($selected, $range);

        $history = RentPayment::where('lease_id', $selected->id)
            ->where('due_date', '>=', $from->toDateString())
            ->where('due_date', '<=', $to->toDateString())
            ->orderByDesc('due_date')
            ->get();

        // ── KPI strip (selected lease + period) ──────────────────────────────
        $paid = $history->where('status', 'paid');
        $totalPaid = (float) $paid->sum('amount');
        $avgPayment = $paid->count() > 0 ? (float) ($totalPaid / $paid->count()) : 0.0;

        // On-time streak (consecutive most-recent paid-on-time, current lease)
        $sortedPaid = $payments->where('status', 'paid')->sortByDesc('due_date')->values();
        $streak = 0;
        foreach ($sortedPaid as $p) {
            if ($p->paid_at && $p->due_date && $p->paid_at->lte(CarbonImmutable::parse($p->due_date)->endOfDay()->addDays(5))) {
                $streak++;
            } else {
                break;
            }
        }

        $outstanding = (float) $payments
            ->whereIn('status', ['pending', 'overdue', 'partial'])
            ->where(fn ($p) => CarbonImmutable::parse($p->due_date)->lessThan($now))
            ->sum('amount');

        // ── Rows for the table (selected lease + period) ─────────────────────
        $rows = $history->map(function (RentPayment $p) {
            $period = CarbonImmutable::parse($p->period_month . '-01');
            $due = CarbonImmutable::parse($p->due_date);

            $statusLabel = match ($p->status) {
                'paid'    => $p->paid_at && $p->paid_at->lte($due->endOfDay()->addDays(5)) ? 'PAID · ON TIME' : 'PAID',
                'pending' => 'PENDING',
                'overdue' => 'OVERDUE',
                'partial' => 'PARTIAL',
                default   => strtoupper($p->status),
            };

            return [
                'id'           => $p->id,
                'date'         => ($p->paid_at ?? $due)->format('d M Y'),
                'description'  => $period->format('F Y') . ' rent' . ((float) $p->late_fee > 0 ? ' + late fee' : ''),
                'late_fee'     => (float) $p->late_fee,
                'method'       => $p->payment_method,
                'reference'    => $p->paystack_reference,
                'status'       => $p->status,
                'status_label' => $statusLabel,
                'amount'       => (float) $p->amount,
                'has_receipt'  => $p->status === 'paid',
            ];
        })->values();

        // ── Due now (arrears first, then current) ────────────────────────────
        // Overdue prior months surface ahead of the current month so the tenant
        // clears arrears first (pay-and-stay).
        $upcoming = $payments
            ->whereIn('status', ['overdue', 'pending', 'partial'])
            ->sortBy('due_date')
            ->values()
            ->take(4)
            ->map(function (RentPayment $p) use ($now) {
                $due = CarbonImmutable::parse($p->due_date);
                $days = (int) $now->startOfDay()->diffInDays($due->startOfDay(), false);
                return [
                    'id'             => $p->id,
                    'period'         => $p->period_month,
                    'period_label'   => CarbonImmutable::parse($p->period_month . '-01')->format('F Y') . ' rent',
                    'due_date'       => $due->format('d M Y'),
                    'days_remaining' => $days,
                    'amount'         => (float) $p->amount,
                    'late_fee'       => (float) $p->late_fee,
                    'is_overdue'     => $days < 0,
                ];
            });

        // Paid up: synthesize next month's rent (due on the 1st). The current
        // month is already settled, so it must never be offered again.
        if ($upcoming->isEmpty()) {
            $cursor = $now->startOfMonth()->addMonth();
            $upcoming = collect([[
                'id'             => null,
                'period'         => $cursor->format('Y-m'),
                'period_label'   => $cursor->format('F Y') . ' rent',
                'due_date'       => $cursor->format('d M Y'),
                'days_remaining' => (int) $now->startOfDay()->diffInDays($cursor->startOfDay(), false),
                'amount'         => $this->billing->rentForPeriod($lease, $cursor),
                'late_fee'       => 0.0,
                'is_overdue'     => false,
            ]]);
        }

        return Inertia::render('Tenant/Payments', [
            'tenant' => [
                'id'   => $user->id,
                'name' => $user->name,
            ],
            'lease' => [
                'id'           => $lease->id,
                'monthly_rent' => (float) $lease->monthly_rent,
                'address'      => $lease->listing?->address ?? $lease->listing?->title ?? '',
                'late_fee'     => $lease->lateFeeSummary(),
            ],
            'kpis' => [
                'total_paid'  => $totalPaid,
                'count'       => $paid->count(),
                'streak'      => $streak,
                'avg_payment' => $avgPayment,
                'outstanding' => $outstanding,
            ],
            'rows'       => $rows,
            'upcoming'   => $upcoming->values(),
            'statements' => app(TenantStatementService::class)->availableMonths($selected, $from),
            'filters'    => [
                'lease'       => $selected->id === $lease->id ? null : $selected->id,
                'range'       => $range,
                'range_label' => StatementRange::LABELS[$range],
                'from'        => $from->format('d M Y'),
                'to'          => $to->format('d M Y'),
            ],
            'ranges'     => StatementRange::options(),
            'leases'     => $this->tenantLeases($request)->map(fn (Lease $l) => [
                'id'      => $l->id,
                'name'    => ($l->listing?->address ?: $l->listing?->title ?: 'Lease ' . $l->id)
                    . ' · ' . CarbonImmutable::parse($l->start_date)->format('M Y')
                    . ($l->end_date ? ' – ' . CarbonImmutable::parse($l->end_date)->format('M Y') : ''),
                'current' => $l->id === $lease->id,
            ])->values(),
        ]);
    }

    /**
     * Download / stream a rent payment receipt PDF.
     * Tenants can only access their own lease payments.
     */
    public function receipt(Request $request, RentPayment $payment, PdfService $pdf)
    {
        $this->resolveLease($request);
        abort_unless(Lease::whereKey($payment->lease_id)->where('tenant_id', $request->user()->id)->exists(), 403);
        abort_unless($payment->paid_at !== null, 404, 'Receipt is only available for paid payments.');

        return $pdf->rentReceipt($payment, download: $request->boolean('download'));
    }

    /**
     * GET /tenant/payments/statement.pdf[?month=YYYY-MM] — full account
     * statement, or a single month's statement.
     */
    public function statement(Request $request, PdfService $pdf)
    {
        $lease = $this->resolveLease($request);
        $this->billing->ensureCharges($lease);

        [$lease, $range] = $this->filters($request, $lease, default: 'lease');
        $this->billing->ensureCharges($lease);

        $month = $request->query('month');
        if ($month !== null) {
            abort_unless(is_string($month) && preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month), 404);
            $start = CarbonImmutable::parse($lease->start_date)->format('Y-m');
            abort_if($month < $start || $month > CarbonImmutable::now()->format('Y-m'), 404);
        }

        return $pdf->tenantStatement($lease, $month, download: $request->boolean('download'), range: $range);
    }

    /** Every lease this tenant has had, newest first. */
    private function tenantLeases(Request $request)
    {
        return Lease::where('tenant_id', $request->user()->id)->with('listing:id,title,address')->orderByDesc('start_date')->get();
    }

    /**
     * ?lease={id} picks one of the tenant's own leases (else 404; default the
     * current lease) and ?range=3|6|12|lease the period.
     *
     * @return array{0: Lease, 1: string}
     */
    private function filters(Request $request, Lease $current, string $default = '12'): array
    {
        $lease = $current;
        if ($request->filled('lease') && (int) $request->query('lease') !== $current->id) {
            $lease = Lease::where('tenant_id', $request->user()->id)->with('listing')->find((int) $request->query('lease'));
            abort_if($lease === null, 404);
        }

        $range = (string) $request->query('range', $default);
        if (! StatementRange::valid($range)) {
            $range = $default;
        }

        return [$lease, $range];
    }
}
