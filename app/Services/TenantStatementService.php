<?php

namespace App\Services;

use App\Models\Deposit;
use App\Models\Lease;
use App\Models\RentPayment;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Tenant account statements built from the rent ledger (`rent_payments`):
 * every monthly charge is a debit on its due date, every paid charge a credit
 * on its paid date, with a running balance (positive = tenant owes).
 *
 * - full statement:   lease start → today (or lease end), plus deposit summary
 * - monthly statement: one calendar month with opening + closing balance
 */
class TenantStatementService
{
    /**
     * @return array{
     *   from: CarbonImmutable, to: CarbonImmutable, opening: float, closing: float,
     *   charged: float, paid: float, lines: array<int, array{date: CarbonImmutable, description: string, reference: string, charge: float, payment: float, balance: float}>
     * }
     */
    public function build(Lease $lease, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $entries = $this->entries($lease);

        $opening = $entries
            ->filter(fn ($e) => $e['date']->lt($from))
            ->sum(fn ($e) => $e['charge'] - $e['payment']);

        $balance = (float) $opening;
        $lines = [];
        foreach ($entries->filter(fn ($e) => $e['date']->between($from, $to)) as $e) {
            $balance += $e['charge'] - $e['payment'];
            $lines[] = $e + ['balance' => round($balance, 2)];
        }

        return [
            'from'    => $from,
            'to'      => $to,
            'opening' => round((float) $opening, 2),
            'closing' => round($balance, 2),
            'charged' => round((float) collect($lines)->sum('charge'), 2),
            'paid'    => round((float) collect($lines)->sum('payment'), 2),
            'lines'   => $lines,
        ];
    }

    /** Whole account: lease start → today (capped at lease end). */
    public function full(Lease $lease): array
    {
        $from = CarbonImmutable::parse($lease->start_date)->startOfMonth();
        $to   = CarbonImmutable::now()->endOfDay();
        if ($lease->end_date && CarbonImmutable::parse($lease->end_date)->endOfDay()->lt($to)) {
            $to = CarbonImmutable::parse($lease->end_date)->endOfDay();
        }

        return $this->build($lease, $from, $to);
    }

    /** One calendar month, e.g. "2026-09". */
    public function month(Lease $lease, string $period): array
    {
        $start = CarbonImmutable::createFromFormat('Y-m-d', $period . '-01')->startOfDay();

        return $this->build($lease, $start, $start->endOfMonth());
    }

    /**
     * Months that have a statement (lease start month → current month), newest first.
     *
     * @return array<int, array{period: string, label: string, charged: float, paid: float, closing: float}>
     */
    public function availableMonths(Lease $lease): array
    {
        $first = CarbonImmutable::parse($lease->start_date)->startOfMonth();
        $last  = CarbonImmutable::now()->startOfMonth();
        if ($lease->end_date && CarbonImmutable::parse($lease->end_date)->startOfMonth()->lt($last)) {
            $last = CarbonImmutable::parse($lease->end_date)->startOfMonth();
        }

        $months = [];
        for ($m = $last; $m->gte($first); $m = $m->subMonth()) {
            $s = $this->month($lease, $m->format('Y-m'));
            $months[] = [
                'period'  => $m->format('Y-m'),
                'label'   => $m->format('F Y'),
                'charged' => $s['charged'],
                'paid'    => $s['paid'],
                'closing' => $s['closing'],
            ];
        }

        return $months;
    }

    public function deposit(Lease $lease): ?Deposit
    {
        return Deposit::where('lease_id', $lease->id)->first();
    }

    /** Ledger entries (charges + payments), chronological. */
    private function entries(Lease $lease): Collection
    {
        $rows = RentPayment::where('lease_id', $lease->id)->orderBy('due_date')->get();
        $entries = collect();

        foreach ($rows as $p) {
            $period = CarbonImmutable::parse($p->period_month . '-01')->format('F Y');
            $due    = CarbonImmutable::parse($p->due_date)->startOfDay();

            $entries->push([
                'date'        => $due,
                'description' => "Rent — {$period}",
                'reference'   => 'INV-' . $p->period_month,
                'charge'      => round((float) $p->amount - (float) $p->late_fee, 2),
                'payment'     => 0.0,
                'order'       => 0,
            ]);

            if ((float) $p->late_fee > 0) {
                $entries->push([
                    'date'        => CarbonImmutable::parse($p->late_fee_applied_at ?? $p->due_date)->startOfDay(),
                    'description' => "Late payment penalty � {$period}",
                    'reference'   => 'PEN-' . $p->period_month,
                    'charge'      => (float) $p->late_fee,
                    'payment'     => 0.0,
                    'order'       => 0,
                ]);
            }

            if ($p->status === 'paid' && $p->paid_at) {
                $entries->push([
                    'date'        => CarbonImmutable::parse($p->paid_at),
                    'description' => "Payment received — {$period} rent (" . $this->methodLabel($p->payment_method) . ')',
                    'reference'   => $p->paystack_reference ?: 'RCP-' . str_pad((string) $p->id, 6, '0', STR_PAD_LEFT),
                    'charge'      => 0.0,
                    'payment'     => (float) $p->amount,
                    'order'       => 1,
                ]);
            }
        }

        return $entries
            ->sortBy(fn ($e) => $e['date']->format('YmdHis') . $e['order'])
            ->map(fn ($e) => collect($e)->except('order')->all())
            ->values();
    }

    private function methodLabel(?string $method): string
    {
        return match ($method) {
            'paystack_card' => 'card',
            'paystack_eft'  => 'Paystack EFT',
            'debit_order'   => 'debit order',
            'manual'        => 'EFT',
            default         => 'payment',
        };
    }
}
