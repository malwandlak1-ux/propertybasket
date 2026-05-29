<?php

namespace App\Http\Controllers\Payments;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Tenant\Concerns\ResolvesTenant;
use App\Models\Commission;
use App\Models\RentPayment;
use App\Notifications\CommissionPaid;
use App\Notifications\MaintenanceInvoicePaid;
use App\Notifications\RentPaymentReceived;
use App\Services\PaystackService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

class PaystackController extends Controller
{
    use ResolvesTenant;

    public function __construct(private readonly PaystackService $paystack) {}

    /**
     * Tenant clicks "Pay rent now" → POST here → redirect to Paystack checkout.
     */
    public function initialize(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'period' => ['nullable', 'string', 'regex:/^\d{4}-\d{2}$/'],
        ]);

        $lease = $this->resolveLease($request);
        $period = $data['period'] ?? now()->format('Y-m');

        $init = $this->paystack->initializePayment($lease, $period);

        // External redirect — Inertia doesn't intercept Location: with a full URL.
        return redirect()->away($init['authorization_url']);
    }

    /**
     * Paystack redirects the user back here after they finish (or cancel) checkout.
     * We verify the reference and route them to the payments page with a flash.
     */
    public function callback(Request $request): RedirectResponse
    {
        $reference = (string) $request->query('reference', '');
        if ($reference === '') {
            return redirect()->route('tenant.payments.index')
                ->with('error', 'Missing payment reference.');
        }

        try {
            $payment = $this->paystack->verifyTransaction($reference);
        } catch (\Throwable $e) {
            Log::error('Paystack verify failed', ['error' => $e->getMessage(), 'reference' => $reference]);
            return redirect()->route('tenant.payments.index')
                ->with('error', 'Could not verify your payment. Please contact support if you were charged.');
        }

        if (! $payment) {
            return redirect()->route('tenant.payments.index')
                ->with('error', 'Payment reference not recognised.');
        }

        if ($payment->status === 'paid') {
            // Fire receipt email + in-app notification to the tenant.
            $payment->loadMissing('lease.tenant');
            $tenant = $payment->lease?->tenant;
            if ($tenant) {
                $tenant->notify(new RentPaymentReceived($payment));
            }
            return redirect()->route('tenant.payments.index')
                ->with('success', 'Payment successful. Your receipt has been emailed to you.');
        }

        return redirect()->route('tenant.payments.index')
            ->with('error', 'Payment did not complete (status: ' . $payment->status . ').');
    }

    /**
     * Paystack server-to-server webhook.
     * Verifies HMAC, then dispatches actions based on `event`.
     */
    public function webhook(Request $request): Response
    {
        if (! $this->paystack->verifyWebhook($request)) {
            Log::warning('Paystack webhook signature mismatch', ['ip' => $request->ip()]);
            return response('invalid signature', 401);
        }

        $event = (string) $request->input('event', '');
        $data  = (array)  $request->input('data', []);

        Log::info('Paystack webhook', ['event' => $event, 'reference' => $data['reference'] ?? null]);

        try {
            match ($event) {
                'charge.success'   => $this->handleChargeSuccess($data),
                'transfer.success' => $this->handleTransferSuccess($data),
                'transfer.failed', 'transfer.reversed' => $this->handleTransferFailed($data),
                default            => null, // unknown event — ack but no-op
            };
        } catch (\Throwable $e) {
            Log::error('Paystack webhook handler error', ['event' => $event, 'error' => $e->getMessage()]);
            // Still respond 200 so Paystack doesn't keep retrying — we logged it.
        }

        return response('ok', 200);
    }

    // ─── Webhook dispatchers ────────────────────────────────────────────

    private function handleChargeSuccess(array $data): void
    {
        $reference = (string) ($data['reference'] ?? '');
        if ($reference === '') {
            return;
        }
        $payment = $this->paystack->verifyTransaction($reference);
        if ($payment && $payment->status === 'paid') {
            $tenant = $payment->lease?->tenant;
            if ($tenant) {
                $tenant->notify(new RentPaymentReceived($payment));
            }
        }
    }

    private function handleTransferSuccess(array $data): void
    {
        $transferCode = (string) ($data['transfer_code'] ?? '');
        if ($transferCode === '') {
            return;
        }
        // Update matching commission row.
        $commission = Commission::where('paystack_transfer_id', $transferCode)->first();
        if ($commission) {
            $commission->update(['status' => 'paid', 'paid_at' => now()]);
        }
    }

    private function handleTransferFailed(array $data): void
    {
        $transferCode = (string) ($data['transfer_code'] ?? '');
        if ($transferCode === '') {
            return;
        }
        $commission = Commission::where('paystack_transfer_id', $transferCode)->first();
        if ($commission) {
            $commission->update(['status' => 'blocked', 'blocked_reason' => 'transfer_failed']);
        }
    }
}
