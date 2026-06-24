<?php

namespace App\Services;

use App\Models\Commission;
use App\Models\Lease;
use App\Models\PayoutBatch;
use App\Models\PlatformTransaction;
use App\Models\RentPayment;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\Client\Response;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Paystack gateway. Operates in two modes:
 *
 *   STUB (default in dev / when no secret key set)
 *     Returns deterministic fake identifiers. No network calls. Lets the
 *     platform demo end-to-end against test data.
 *
 *   LIVE (production / when PAYSTACK_SECRET_KEY is set and PAYSTACK_STUB=false)
 *     Calls the real Paystack REST API at https://api.paystack.co
 *
 * Switch between modes via .env:
 *     PAYSTACK_SECRET_KEY=sk_test_xxx
 *     PAYSTACK_PUBLIC_KEY=pk_test_xxx
 *     PAYSTACK_STUB=false           # explicit override
 */
class PaystackService
{
    public function __construct(
        private readonly ?string $secretKey = null,
        private readonly ?string $baseUrl = null,
        private readonly ?bool $stub = null,
    ) {}

    // ─── Mode / wiring helpers ──────────────────────────────────────────

    public function isStub(): bool
    {
        if ($this->stub !== null) {
            return $this->stub;
        }
        return (bool) config('services.paystack.stub');
    }

    private function key(): string
    {
        return $this->secretKey ?? (string) config('services.paystack.secret_key');
    }

    private function http(): PendingRequest
    {
        return Http::baseUrl($this->baseUrl ?? config('services.paystack.base_url'))
            ->withToken($this->key())
            ->acceptJson()
            ->asJson()
            ->timeout(15);
    }

    // ─── Rent payment initialization (Tenant pays rent) ─────────────────

    /**
     * Initialize a Paystack transaction for a rent period.
     * Returns ['reference' => string, 'authorization_url' => string, 'access_code' => string].
     */
    public function initializePayment(Lease $lease, string $period): array
    {
        $payment = RentPayment::firstOrNew(
            ['lease_id' => $lease->id, 'period_month' => $period],
            [
                'amount'   => $lease->monthly_rent,
                'due_date' => \Carbon\Carbon::createFromFormat('Y-m', $period)->startOfMonth(),
            ]
        );
        $payment->status = 'pending';
        $payment->save();

        $reference = 'PB_' . strtoupper(Str::random(12)) . '_' . $payment->id;

        if ($this->isStub()) {
            $payment->update(['paystack_reference' => $reference]);
            return [
                'reference'         => $reference,
                'authorization_url' => url('/payments/paystack/callback?reference=' . $reference . '&stub=1'),
                'access_code'       => 'STUB_' . Str::random(20),
            ];
        }

        $resp = $this->http()->post('/transaction/initialize', [
            'email'        => $lease->tenant?->email,
            'amount'       => (int) round((float) $lease->monthly_rent * 100), // kobo
            'reference'    => $reference,
            'currency'     => 'ZAR',
            'callback_url' => config('services.paystack.callback_url') ?: url('/payments/paystack/callback'),
            'metadata'     => [
                'lease_id'     => $lease->id,
                'tenant_id'    => $lease->tenant_id,
                'period_month' => $period,
                'custom_fields' => [
                    [
                        'display_name'  => 'Property',
                        'variable_name' => 'property',
                        'value'         => $lease->listing?->address ?? $lease->listing?->title,
                    ],
                ],
            ],
        ]);

        $this->assertOk($resp, 'transaction/initialize');
        $data = $resp->json('data');

        $payment->update(['paystack_reference' => $data['reference']]);

        return [
            'reference'         => $data['reference'],
            'authorization_url' => $data['authorization_url'],
            'access_code'       => $data['access_code'],
        ];
    }

    /**
     * Verify a Paystack transaction reference after callback / webhook.
     * Marks the matching RentPayment as paid on success.
     */
    public function verifyTransaction(string $reference): ?RentPayment
    {
        $payment = RentPayment::where('paystack_reference', $reference)->first();
        if (! $payment) {
            return null;
        }

        if ($this->isStub() || request()->boolean('stub')) {
            $payment->update([
                'paid_at'        => now(),
                'status'         => 'paid',
                'payment_method' => 'paystack_card',
            ]);
            return $payment->fresh();
        }

        $resp = $this->http()->get("/transaction/verify/{$reference}");
        $this->assertOk($resp, 'transaction/verify');

        $data = $resp->json('data');
        if (($data['status'] ?? null) !== 'success') {
            // Leave payment in 'pending' so the tenant can retry. Real status
            // detail (abandoned / failed / reversed) is logged for audit.
            Log::warning('Paystack verify returned non-success', [
                'reference' => $reference,
                'status'    => $data['status'] ?? 'unknown',
            ]);
            return $payment->fresh();
        }

        // Map Paystack's channel → our enum (paystack_card / paystack_eft).
        // EFT-like channels (bank, ussd, bank_transfer) → paystack_eft; all else → paystack_card.
        $eftChannels = ['bank', 'bank_transfer', 'ussd'];
        $method = in_array($data['channel'] ?? 'card', $eftChannels, true)
            ? 'paystack_eft'
            : 'paystack_card';

        $payment->update([
            'paid_at'                 => isset($data['paid_at']) ? \Carbon\Carbon::parse($data['paid_at']) : now(),
            'status'                  => 'paid',
            'payment_method'          => $method,
            'paystack_transaction_id' => (string) ($data['id'] ?? ''),
        ]);

        return $payment->fresh();
    }

    // ─── Subscription / platform-plan payment (Agency & Landlord) ───────

    /**
     * Initialize a Paystack transaction for a platform subscription plan.
     * Records a pending PlatformTransaction against the owner (Agency/Landlord)
     * and returns ['reference' => ..., 'authorization_url' => ...].
     *
     * @param Model $owner   The Agency or Landlord paying.
     * @param int   $amount  Plan price in Rand.
     */
    public function initializeSubscriptionPayment(User $user, Model $owner, string $planKey, int $amount): array
    {
        $reference = 'SUB_' . strtoupper(Str::random(12)) . '_' . $owner->getKey();

        PlatformTransaction::create([
            'subscriber_type'    => $owner->getMorphClass(),
            'subscriber_id'      => $owner->getKey(),
            'type'               => 'subscription',
            'amount'             => $amount,
            'description'        => $planKey,
            'paystack_reference' => $reference,
            'status'             => 'pending',
        ]);

        if ($this->isStub()) {
            return [
                'reference'         => $reference,
                'authorization_url' => url('/billing/callback?reference=' . $reference . '&stub=1'),
            ];
        }

        $resp = $this->http()->post('/transaction/initialize', [
            'email'        => $user->email,
            'amount'       => $amount * 100, // kobo/cents
            'reference'    => $reference,
            'currency'     => 'ZAR',
            'callback_url' => url('/billing/callback'),
            'metadata'     => [
                'plan_key'        => $planKey,
                'subscriber_type' => $owner->getMorphClass(),
                'subscriber_id'   => $owner->getKey(),
            ],
        ]);

        $this->assertOk($resp, 'transaction/initialize');

        return [
            'reference'         => $resp->json('data.reference'),
            'authorization_url' => $resp->json('data.authorization_url'),
        ];
    }

    /**
     * Verify a subscription transaction reference after callback. Marks the
     * matching PlatformTransaction paid on success and returns it (or null when
     * the reference is unknown).
     */
    public function verifySubscriptionPayment(string $reference): ?PlatformTransaction
    {
        $txn = PlatformTransaction::where('paystack_reference', $reference)->first();
        if (! $txn) {
            return null;
        }

        if ($this->isStub() || request()->boolean('stub')) {
            $txn->update(['status' => 'paid']);
            return $txn->fresh();
        }

        $resp = $this->http()->get("/transaction/verify/{$reference}");
        $this->assertOk($resp, 'transaction/verify');

        if (($resp->json('data.status') ?? null) === 'success') {
            $txn->update(['status' => 'paid']);
        } else {
            $txn->update(['status' => 'failed']);
        }

        return $txn->fresh();
    }

    // ─── Webhook signature verification ─────────────────────────────────

    public function verifyWebhook(Request $request): bool
    {
        if ($this->isStub()) {
            return true;
        }
        $signature = $request->header('x-paystack-signature');
        if (! $signature) {
            return false;
        }
        $expected = hash_hmac('sha512', $request->getContent(), $this->key());
        return hash_equals($expected, $signature);
    }

    // ─── Transfer recipients (for commission payouts) ───────────────────

    public function createTransferRecipient(User $user, ?array $bank = null): string
    {
        if ($user->paystack_recipient_code) {
            return $user->paystack_recipient_code;
        }

        if ($this->isStub()) {
            $code = 'RCP_STUB_' . Str::random(12);
            $user->forceFill(['paystack_recipient_code' => $code])->save();
            return $code;
        }

        if (! $bank) {
            throw new \InvalidArgumentException('Bank details required for live mode (account_number + bank_code).');
        }

        $resp = $this->http()->post('/transferrecipient', [
            'type'           => 'nuban',
            'name'           => $user->name,
            'account_number' => $bank['account_number'],
            'bank_code'      => $bank['bank_code'],
            'currency'       => 'ZAR',
        ]);
        $this->assertOk($resp, 'transferrecipient');

        $code = $resp->json('data.recipient_code');
        $user->forceFill(['paystack_recipient_code' => $code])->save();
        return $code;
    }

    // ─── Transfers (commission payouts) ─────────────────────────────────

    public function initiateTransfer(Commission $commission): string
    {
        $commission->loadMissing('agent');

        if ($this->isStub()) {
            $id = 'TRF_STUB_' . Str::random(16);
            $commission->update([
                'paystack_transfer_id' => $id,
                'status'               => 'paid',
                'paid_at'              => now(),
            ]);
            return $id;
        }

        $recipient = $commission->agent?->paystack_recipient_code;
        if (! $recipient) {
            throw new \RuntimeException("Agent #{$commission->agent_id} has no Paystack recipient set up.");
        }

        $resp = $this->http()->post('/transfer', [
            'source'    => 'balance',
            'amount'    => (int) round((float) $commission->agent_net * 100),
            'recipient' => $recipient,
            'reason'    => "Commission for deal #{$commission->id}",
            'reference' => 'CMM_' . $commission->id . '_' . Str::random(8),
            'currency'  => 'ZAR',
        ]);
        $this->assertOk($resp, 'transfer');

        $transferId = (string) $resp->json('data.transfer_code');
        $commission->update([
            'paystack_transfer_id' => $transferId,
            'status'               => 'paid',
            'paid_at'              => now(),
        ]);

        return $transferId;
    }

    public function runPayoutBatch(PayoutBatch $batch): void
    {
        if ($this->isStub()) {
            $bulkId = 'BLK_STUB_' . Str::random(16);
            foreach ($batch->commissions()->where('status', 'approved')->get() as $commission) {
                $this->initiateTransfer($commission);
            }
            $batch->update(['paystack_bulk_transfer_id' => $bulkId, 'status' => 'completed']);
            return;
        }

        $commissions = $batch->commissions()->where('status', 'approved')->with('agent')->get();
        if ($commissions->isEmpty()) {
            $batch->update(['status' => 'completed']);
            return;
        }

        $transfers = $commissions->map(function (Commission $c) {
            $recipient = $c->agent?->paystack_recipient_code;
            if (! $recipient) {
                throw new \RuntimeException("Agent #{$c->agent_id} has no Paystack recipient set up.");
            }
            return [
                'amount'    => (int) round((float) $c->agent_net * 100),
                'recipient' => $recipient,
                'reference' => 'CMM_' . $c->id . '_' . Str::random(8),
                'reason'    => "Commission for deal #{$c->id}",
            ];
        })->all();

        $resp = $this->http()->post('/transfer/bulk', [
            'source'    => 'balance',
            'currency'  => 'ZAR',
            'transfers' => $transfers,
        ]);
        $this->assertOk($resp, 'transfer/bulk');

        $bulkId = (string) $resp->json('data.batch_code', Str::random(16));
        $batch->update([
            'paystack_bulk_transfer_id' => $bulkId,
            'status'                    => 'completed',
        ]);

        $commissions->each->update([
            'status'  => 'paid',
            'paid_at' => now(),
        ]);
    }

    // ─── Internals ──────────────────────────────────────────────────────

    private function assertOk(Response $resp, string $endpoint): void
    {
        if ($resp->successful() && $resp->json('status') === true) {
            return;
        }
        Log::error("Paystack {$endpoint} failed", [
            'status' => $resp->status(),
            'body'   => $resp->body(),
        ]);
        throw new RequestException($resp);
    }
}
