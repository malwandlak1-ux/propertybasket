<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Tenant\Concerns\ResolvesTenant;
use App\Models\RentPayment;
use App\Services\PdfService;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PaymentsController extends Controller
{
    use ResolvesTenant;

    public function index(Request $request): Response
    {
        $lease = $this->resolveLease($request);
        $user  = $request->user();
        $now   = CarbonImmutable::now();

        $payments = RentPayment::where('lease_id', $lease->id)
            ->orderByDesc('due_date')
            ->get();

        // ── KPI strip ────────────────────────────────────────────────────────
        $paid = $payments->where('status', 'paid');
        $totalPaid = (float) $paid->sum('amount');
        $avgPayment = $paid->count() > 0 ? (float) ($totalPaid / $paid->count()) : 0.0;

        // On-time streak (consecutive most-recent paid-on-time)
        $sortedPaid = $paid->sortByDesc('due_date')->values();
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

        // ── Rows for the table ───────────────────────────────────────────────
        $rows = $payments->map(function (RentPayment $p) {
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
                'date'         => ($p->paid_at ?? $due)->format('Y/m/d'),
                'description'  => $period->format('F Y') . ' rent',
                'method'       => $p->payment_method,
                'reference'    => $p->paystack_reference,
                'status'       => $p->status,
                'status_label' => $statusLabel,
                'amount'       => (float) $p->amount,
                'has_receipt'  => $p->status === 'paid',
            ];
        })->values();

        // ── Upcoming (pending only) ──────────────────────────────────────────
        $upcoming = $payments
            ->where('status', 'pending')
            ->sortBy('due_date')
            ->values()
            ->take(3)
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
                    'is_overdue'     => $days < 0,
                ];
            });

        // If no pending exists, synthesize the next month
        if ($upcoming->isEmpty()) {
            $cursor = $now->day(25);
            if ($cursor->lessThan($now)) {
                $cursor = $cursor->addMonth();
            }
            $upcoming = collect([[
                'id'             => null,
                'period'         => $cursor->format('Y-m'),
                'period_label'   => $cursor->format('F Y') . ' rent',
                'due_date'       => $cursor->format('d M Y'),
                'days_remaining' => (int) $now->startOfDay()->diffInDays($cursor->startOfDay(), false),
                'amount'         => (float) $lease->monthly_rent,
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
            ],
            'kpis' => [
                'total_paid'  => $totalPaid,
                'count'       => $paid->count(),
                'streak'      => $streak,
                'avg_payment' => $avgPayment,
                'outstanding' => $outstanding,
            ],
            'rows'     => $rows,
            'upcoming' => $upcoming->values(),
        ]);
    }

    /**
     * Download / stream a rent payment receipt PDF.
     * Tenants can only access their own lease payments.
     */
    public function receipt(Request $request, RentPayment $payment, PdfService $pdf)
    {
        $lease = $this->resolveLease($request);
        abort_unless($payment->lease_id === $lease->id, 403);
        abort_unless($payment->paid_at !== null, 404, 'Receipt is only available for paid payments.');

        return $pdf->rentReceipt($payment, download: $request->boolean('download'));
    }
}
