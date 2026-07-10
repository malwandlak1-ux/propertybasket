<?php

namespace App\Services;

use App\Models\Deposit;
use App\Models\Lease;
use App\Models\RentPayment;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Owns the "pay-and-stay" rent ledger for a lease.
 *
 * Each calendar month from the lease start up to the current month must have a
 * rent charge. On the 1st the current month's rent falls due; anything unpaid
 * from a prior month is arrears. Nothing here talks to Paystack — it only keeps
 * the `rent_payments` ledger honest so the tenant is always shown what they owe.
 */
class LeaseBillingService
{
    /** Statuses that represent money still owed. */
    public const UNPAID = ['pending', 'overdue', 'partial'];

    /**
     * Ensure a rent charge exists for every month from lease start → current,
     * apply annual escalation, and flip past-due unpaid charges to "overdue".
     * Safe to call repeatedly (idempotent) — used both by the scheduled command
     * and lazily on dashboard load.
     */
    public function ensureCharges(Lease $lease): void
    {
        if (! in_array($lease->status, ['active', 'pending'], true)) {
            return;
        }
        if (! $lease->start_date) {
            return;
        }

        $today  = CarbonImmutable::now()->startOfDay();
        $cursor = CarbonImmutable::parse($lease->start_date)->startOfMonth();
        $current = $today->startOfMonth();

        // Never bill beyond the lease end.
        $end = $lease->end_date ? CarbonImmutable::parse($lease->end_date)->startOfMonth() : $current;
        $lastPeriod = $current->lessThanOrEqualTo($end) ? $current : $end;

        $existing = RentPayment::where('lease_id', $lease->id)
            ->get()
            ->keyBy('period_month');

        while ($cursor->lessThanOrEqualTo($lastPeriod)) {
            $period  = $cursor->format('Y-m');
            $dueDate = $cursor->day(1);
            $amount  = $this->rentForPeriod($lease, $cursor);

            /** @var RentPayment|null $charge */
            $charge = $existing->get($period);

            if (! $charge) {
                RentPayment::create([
                    'lease_id'     => $lease->id,
                    'period_month' => $period,
                    'amount'       => $amount,
                    'due_date'     => $dueDate->toDateString(),
                    'status'       => $dueDate->lessThan($today) ? 'overdue' : 'pending',
                ]);
            } elseif (in_array($charge->status, ['pending', 'overdue'], true)) {
                // Keep the status honest as time passes. Don't touch paid/partial.
                $target = $dueDate->lessThan($today) ? 'overdue' : 'pending';
                if ($charge->status !== $target) {
                    $charge->update(['status' => $target]);
                }
            }

            $cursor = $cursor->addMonth();
        }
    }

    /**
     * The rent for a given month, escalated annually from the lease start on
     * each anniversary by `escalation_percent`.
     */
    public function rentForPeriod(Lease $lease, CarbonImmutable $period): float
    {
        $base = (float) $lease->monthly_rent;
        $esc  = (float) ($lease->escalation_percent ?? 0);

        if ($esc <= 0) {
            return round($base, 2);
        }

        $start = CarbonImmutable::parse($lease->start_date)->startOfMonth();
        $monthsElapsed = ($period->year - $start->year) * 12 + ($period->month - $start->month);
        $years = intdiv(max(0, $monthsElapsed), 12);

        return round($base * (1 + $esc / 100) ** $years, 2);
    }

    /**
     * Snapshot of what the tenant currently owes: the current month plus any
     * unpaid prior months (arrears), with a per-period breakdown.
     *
     * @return array{
     *   current: array|null,
     *   arrears: array<int,array>,
     *   arrears_total: float,
     *   total_due: float,
     *   next_charge: array|null
     * }
     */
    public function outstanding(Lease $lease): array
    {
        $now = CarbonImmutable::now();
        $currentPeriod = $now->format('Y-m');

        $unpaid = RentPayment::where('lease_id', $lease->id)
            ->whereIn('status', self::UNPAID)
            ->orderBy('due_date')
            ->get();

        $current = null;
        $arrears = [];

        foreach ($unpaid as $p) {
            $row = $this->chargeRow($p, $now);
            if ($p->period_month === $currentPeriod) {
                $current = $row;
            } elseif ($p->period_month < $currentPeriod) {
                $arrears[] = $row;
            }
            // Future-dated charges (period > current) are ignored here — not yet due.
        }

        $arrearsTotal = array_sum(array_column($arrears, 'amount'));
        $currentAmount = $current['amount'] ?? 0.0;

        // If the current month hasn't been generated yet (e.g. lease ended, or
        // called before ensureCharges), fall back to the escalated rent so the
        // UI always has a figure to show.
        if ($current === null) {
            $currentAmount = $this->rentForPeriod($lease, $now->startOfMonth());
        }

        return [
            'current'       => $current,
            'arrears'       => $arrears,
            'arrears_total' => round((float) $arrearsTotal, 2),
            'total_due'     => round((float) ($currentAmount + $arrearsTotal), 2),
            'next_charge'   => $current,
        ];
    }

    /** Ensure a deposit ledger row exists for the lease (raised as "due"). */
    public function ensureDeposit(Lease $lease): Deposit
    {
        $deposit = Deposit::where('lease_id', $lease->id)->first();

        if (! $deposit) {
            $deposit = Deposit::create([
                'lease_id'         => $lease->id,
                'amount_deposited' => (float) ($lease->deposit_amount ?? 0),
                'interest_rate'    => (float) ($lease->deposit_interest_rate ?? 6.75),
                'accrued_interest' => 0,
                'status'           => Deposit::STATUS_DUE,
            ]);
        }

        return $deposit;
    }

    /**
     * Accrue PPRA interest on a held deposit since the last accrual date.
     * No-op while the deposit is still "due" (nothing received yet).
     */
    public function accrueDepositInterest(Deposit $deposit): void
    {
        if (! $deposit->isHeld() || (float) $deposit->amount_deposited <= 0) {
            return;
        }

        $today = CarbonImmutable::now()->startOfDay();
        $from  = $deposit->last_accrual_date
            ? CarbonImmutable::parse($deposit->last_accrual_date)->startOfDay()
            : ($deposit->deposited_at ? CarbonImmutable::parse($deposit->deposited_at)->startOfDay() : $today);

        $days = (int) $from->diffInDays($today);
        if ($days <= 0) {
            return;
        }

        $principal = (float) $deposit->amount_deposited;
        $rate      = (float) $deposit->interest_rate / 100;
        $interest  = $principal * $rate * ($days / 365);

        $deposit->update([
            'accrued_interest'  => round((float) $deposit->accrued_interest + $interest, 2),
            'last_accrual_date' => $today->toDateString(),
        ]);
    }

    private function chargeRow(RentPayment $p, CarbonImmutable $now): array
    {
        $due = CarbonImmutable::parse($p->due_date);

        return [
            'id'             => $p->id,
            'period'         => $p->period_month,
            'period_label'   => CarbonImmutable::parse($p->period_month . '-01')->format('F Y'),
            'due_date'       => $due->format('d M Y'),
            'days_remaining' => (int) $now->startOfDay()->diffInDays($due->startOfDay(), false),
            'amount'         => (float) $p->amount,
            'status'         => $p->status,
            'is_overdue'     => $p->status === 'overdue' || $due->startOfDay()->lessThan($now->startOfDay()),
        ];
    }
}
