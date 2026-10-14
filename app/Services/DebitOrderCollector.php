<?php

namespace App\Services;

use App\Models\DebitOrder;
use App\Models\DebitOrderCollection;
use App\Models\RentPayment;
use App\Notifications\DebitOrderCollectionResult;
use App\Notifications\RentPaymentReceived;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

/**
 * Collects rent on active debit-order mandates.
 *
 * Each month, once a mandate's debit date has arrived, every unpaid rent
 * charge on the lease that falls inside the mandate (due on/after its
 * collect-from date, up to today) is collected. A successful collection marks
 * the charge paid in the rent ledger — the same table the Finance pages and
 * dashboards read — so income updates immediately. A failed attempt is not
 * retried until the next month's debit date; the tenant can pay by hand.
 *
 * Driver (config services.debit_orders.driver):
 *   auto     → 'stub' while Paystack runs in test/stub mode, else 'disabled'
 *   stub     → simulated collection that always succeeds (no money moves)
 *   disabled → nothing is collected (no live debit-order provider wired yet)
 */
class DebitOrderCollector
{
    public function __construct(
        private readonly LeaseBillingService $billing,
        private readonly PaystackService $paystack,
    ) {}

    public function driver(): string
    {
        $driver = (string) config('services.debit_orders.driver', 'auto');

        return $driver === 'auto' ? ($this->paystack->isStub() ? 'stub' : 'disabled') : $driver;
    }

    public function enabled(): bool
    {
        return $this->driver() !== 'disabled';
    }

    /**
     * Run every due collection. Safe to call often (lock + idempotent).
     *
     * @return array{succeeded: int, failed: int}
     */
    public function run(?CarbonImmutable $today = null): array
    {
        $result = ['succeeded' => 0, 'failed' => 0];
        if (! $this->enabled()) {
            return $result;
        }

        $lock = Cache::lock('debit-orders:collect', 300);
        if (! $lock->get()) {
            return $result;
        }

        try {
            $today = ($today ?? CarbonImmutable::now())->startOfDay();

            DebitOrder::where('status', 'active')
                ->whereHas('lease', fn ($q) => $q->whereIn('status', ['active', 'pending']))
                ->with(['lease.tenant', 'lease.listing'])
                ->get()
                ->each(function (DebitOrder $mandate) use ($today, &$result) {
                    foreach ($this->collectMandate($mandate, $today) as $collection) {
                        $result[$collection->status === 'succeeded' ? 'succeeded' : 'failed']++;
                    }
                });
        } finally {
            $lock->release();
        }

        return $result;
    }

    /** @return DebitOrderCollection[] attempts made for this mandate today */
    public function collectMandate(DebitOrder $mandate, CarbonImmutable $today): array
    {
        // Not this month's debit date yet.
        if ($today->lt($mandate->debitDateIn($today))) {
            return [];
        }

        $lease = $mandate->lease;
        $this->billing->ensureCharges($lease);

        $charges = RentPayment::where('lease_id', $lease->id)
            ->whereIn('status', LeaseBillingService::UNPAID)
            ->whereDate('due_date', '>=', $mandate->collectsFrom()->toDateString())
            ->whereDate('due_date', '<=', $today->toDateString())
            ->orderBy('due_date')
            ->get();

        $made = [];
        foreach ($charges as $charge) {
            $previous = DebitOrderCollection::where('rent_payment_id', $charge->id)->get();
            if ($previous->whereIn('status', ['succeeded', 'pending'])->isNotEmpty()) {
                continue;
            }
            // One attempt per charge per month.
            if ($previous->contains(fn ($c) => $c->attempted_at && $c->attempted_at->isSameMonth($today))) {
                continue;
            }

            $made[] = $this->collect($mandate, $charge);
        }

        return $made;
    }

    private function collect(DebitOrder $mandate, RentPayment $charge): DebitOrderCollection
    {
        $collection = DebitOrderCollection::create([
            'debit_order_id'  => $mandate->id,
            'lease_id'        => $charge->lease_id,
            'rent_payment_id' => $charge->id,
            'amount'          => $charge->amount,
            'reference'       => 'DO_' . strtoupper(Str::random(10)) . '_' . $charge->id,
            'status'          => 'pending',
            'attempted_at'    => now(),
        ]);

        [$ok, $reason] = $this->charge($mandate, $collection);

        if ($ok) {
            $collection->update(['status' => 'succeeded', 'settled_at' => now()]);
            $charge->update([
                'status'             => 'paid',
                'paid_at'            => now(),
                'payment_method'     => 'debit_order',
                'paystack_reference' => $collection->reference,
            ]);
        } else {
            $collection->update(['status' => 'failed', 'failure_reason' => $reason]);
        }

        $this->notify($mandate, $collection->fresh(['rentPayment', 'lease.tenant', 'lease.listing']), $charge->fresh());

        return $collection->fresh();
    }

    /** @return array{0: bool, 1: ?string} */
    private function charge(DebitOrder $mandate, DebitOrderCollection $collection): array
    {
        return match ($this->driver()) {
            // Test mode: always succeeds, except the test "decline" account.
            'stub'  => preg_replace('/\D/', '', (string) $mandate->account_number) === '0000000000'
                ? [false, 'Declined by the bank (test decline account).']
                : [true, null],
            default => [false, 'No debit-order provider is configured.'],
        };
    }

    private function notify(DebitOrder $mandate, DebitOrderCollection $collection, RentPayment $charge): void
    {
        $lease = $mandate->lease->loadMissing(['tenant', 'landlord', 'agency.owner']);
        $manager = $lease->agency?->owner ?? $lease->landlord;

        try {
            if ($collection->status === 'succeeded' && $lease->tenant) {
                // Receipt e-mail with the PDF — sent now, not queued: client
                // sites may not run a queue worker.
                Notification::sendNow($lease->tenant, new RentPaymentReceived($charge));
            }
            $recipients = array_filter([$collection->status === 'failed' ? $lease->tenant : null, $manager]);
            if ($recipients) {
                Notification::sendNow($recipients, new DebitOrderCollectionResult($collection));
            }
        } catch (\Throwable $e) {
            Log::warning('Debit order notification failed', ['collection' => $collection->id, 'error' => $e->getMessage()]);
        }
    }
}
