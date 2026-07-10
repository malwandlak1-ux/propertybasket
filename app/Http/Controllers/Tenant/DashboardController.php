<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Tenant\Concerns\ResolvesTenant;
use App\Models\DebitOrder;
use App\Models\MaintenanceRequest;
use App\Models\RentPayment;
use App\Services\LeaseBillingService;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    use ResolvesTenant;

    public function __construct(private readonly LeaseBillingService $billing) {}

    public function overview(Request $request): Response
    {
        $user  = $request->user();
        $lease = $this->resolveLease($request);
        $now   = CarbonImmutable::now();

        // Reconcile the ledger on load so the tenant always sees the true
        // position even if the daily `rent:generate` command hasn't run.
        $this->billing->ensureCharges($lease);
        $depositModel = $this->billing->ensureDeposit($lease);
        $this->billing->accrueDepositInterest($depositModel);
        $depositModel->refresh();

        // ── Amount due (pay-and-stay: this month + any arrears) ──────────────
        $out = $this->billing->outstanding($lease);

        $current = $out['current'];
        $currentDue = $current
            ? CarbonImmutable::parse($current['period'] . '-01')->day(1)
            : $now->day(1);

        $nextDueDisplay = [
            'amount'         => (float) $out['total_due'],
            'current_amount' => (float) ($current['amount'] ?? $this->billing->rentForPeriod($lease, $now->startOfMonth())),
            'due_date'       => $currentDue->format('d M Y'),
            'days_remaining' => (int) $now->startOfDay()->diffInDays($currentDue->startOfDay(), false),
            'period_month'   => $current['period'] ?? $now->format('Y-m'),
            'arrears_total'  => (float) $out['arrears_total'],
            'arrears'        => $out['arrears'],
            'has_arrears'    => count($out['arrears']) > 0,
        ];

        // ── On-time streak ───────────────────────────────────────────────────
        $paidPayments = RentPayment::where('lease_id', $lease->id)
            ->where('status', 'paid')
            ->orderByDesc('due_date')
            ->get();

        $streak = 0;
        foreach ($paidPayments as $p) {
            if ($p->paid_at && $p->due_date && $p->paid_at->lte(CarbonImmutable::parse($p->due_date)->endOfDay()->addDays(5))) {
                $streak++;
            } else {
                break;
            }
        }

        // ── Deposit info (due until the agency marks it received) ────────────
        $depositAmount = (float) ($depositModel->amount_deposited ?: $lease->deposit_amount ?? 0);
        $agency = $lease->agency;
        $depositInfo = [
            'status'           => $depositModel->status,
            'is_due'           => $depositModel->isDue(),
            'amount_deposited' => $depositAmount,
            'accrued_interest' => (float) $depositModel->accrued_interest,
            'interest_rate'    => (float) ($depositModel->interest_rate ?? $lease->deposit_interest_rate ?? 6.75),
            'total_held'       => $depositModel->isHeld()
                ? round($depositAmount + (float) $depositModel->accrued_interest, 2)
                : 0.0,
            'received_at'      => $depositModel->deposited_at?->format('d M Y'),
            'trust'            => $depositModel->isDue() && $agency ? [
                'bank'           => $agency->trust_bank,
                'account_holder' => $agency->trust_account_holder ?: $agency->name,
                'account_number' => $agency->trust_account_number,
                'branch_code'    => $agency->trust_branch_code,
                'account_type'   => $agency->trust_account_type,
                'reference'      => 'DEP-' . $lease->id,
            ] : null,
        ];

        // ── Lease term progress ──────────────────────────────────────────────
        $start = CarbonImmutable::parse($lease->start_date);
        $end   = CarbonImmutable::parse($lease->end_date);
        $total = max(1, (int) $start->diffInDays($end));
        $elapsed = max(0, (int) $start->diffInDays($now));
        $elapsed = min($elapsed, $total);
        $monthsElapsed = (int) floor($start->diffInDays($now) / 30.44);
        $monthsRemaining = max(0, (int) floor($now->diffInDays($end) / 30.44));

        // ── Open maintenance request (most recent) ───────────────────────────
        $openRequest = MaintenanceRequest::where('lease_id', $lease->id)
            ->whereNotIn('status', ['completed', 'paid'])
            ->with('contractor:id,name')
            ->orderByDesc('created_at')
            ->first();

        $openMaintenance = null;
        if ($openRequest) {
            $openMaintenance = [
                'id'           => $openRequest->id,
                'title'        => $openRequest->title,
                'category'     => $openRequest->category,
                'urgency'      => $openRequest->urgency,
                'status'       => $openRequest->status,
                'logged_at'    => $openRequest->created_at?->format('d M Y'),
                'logged_human' => $openRequest->created_at?->diffForHumans() ?? '',
                'photo_count'  => is_array($openRequest->photos) ? count($openRequest->photos) : 0,
                'contractor'   => $openRequest->contractor ? [
                    'name'     => $openRequest->contractor->name,
                    'initials' => collect(explode(' ', $openRequest->contractor->name))->take(2)->map(fn ($w) => mb_substr($w, 0, 1))->implode(''),
                ] : null,
                'preferred_date' => $openRequest->preferred_date?->format('d M Y'),
                'preferred_slot' => $openRequest->preferred_time_slot,
            ];
        }

        // ── Recent payments ──────────────────────────────────────────────────
        $recentPayments = RentPayment::where('lease_id', $lease->id)
            ->where('status', 'paid')
            ->orderByDesc('paid_at')
            ->take(3)
            ->get()
            ->map(fn ($p) => [
                'id'         => $p->id,
                'label'      => CarbonImmutable::parse($p->period_month . '-01')->format('F Y') . ' rent',
                'paid_at'    => $p->paid_at?->format('d M Y'),
                'method'     => $p->payment_method,
                'reference'  => $p->paystack_reference,
                'amount'     => (float) $p->amount,
            ]);

        return Inertia::render('Tenant/Overview', [
            'tenant' => [
                'id'       => $user->id,
                'name'     => $user->name,
                'initials' => collect(explode(' ', $user->name))->take(2)->map(fn ($w) => mb_substr($w, 0, 1))->implode(''),
            ],
            'lease' => [
                'id'             => $lease->id,
                'address'        => trim($lease->listing?->address ?? $lease->listing?->title ?? ''),
                'suburb'         => $lease->listing?->suburb,
                'city'           => $lease->listing?->city,
                'monthly_rent'   => (float) $lease->monthly_rent,
                'start_date'     => $start->format('Y/m/d'),
                'end_date'       => $end->format('Y/m/d'),
                'status'         => $lease->status,
                'progress_pct'   => (int) round(($elapsed / $total) * 100),
                'months_elapsed' => $monthsElapsed,
                'months_remaining' => $monthsRemaining,
            ],
            'next_due'         => $nextDueDisplay,
            'streak'           => $streak,
            'deposit'          => $depositInfo,
            'open_maintenance' => $openMaintenance,
            'recent_payments'  => $recentPayments,
            'agent'            => $lease->agent ? [
                'id'       => $lease->agent->id,
                'name'     => $lease->agent->name,
                'initials' => collect(explode(' ', $lease->agent->name))->take(2)->map(fn ($w) => mb_substr($w, 0, 1))->implode(''),
                'email'    => $lease->agent->email,
                'phone'    => $lease->agent->phone,
                'agency'   => $lease->agency?->name,
            ] : null,
            'debit_order'      => $this->debitOrderPayload($lease->id),
        ]);
    }

    private function debitOrderPayload(int $leaseId): ?array
    {
        $do = DebitOrder::where('lease_id', $leaseId)
            ->where('status', 'active')
            ->latest('id')
            ->first();
        if (! $do) return null;
        return [
            'id'             => $do->id,
            'bank_name'      => $do->bank_name,
            'account_holder' => $do->account_holder,
            'account_number_masked' => self::maskAccount($do->account_number),
            'branch_code'    => $do->branch_code,
            'account_type'   => $do->account_type,
            'debit_day'      => $do->debit_day,
            'signed_at'      => $do->signed_at?->format('d M Y'),
        ];
    }

    private static function maskAccount(?string $n): string
    {
        if (! $n) return '';
        return str_repeat('•', max(strlen($n) - 4, 0)) . substr($n, -4);
    }
}
