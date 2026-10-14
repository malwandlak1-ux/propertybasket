<?php

namespace App\Http\Controllers\Landlord;

use App\Http\Controllers\Landlord\Concerns\ResolvesLandlord;
use App\Models\EftPayment;
use App\Models\Landlord;
use App\Notifications\EftPaymentReviewed;
use App\Notifications\RentPaymentReceived;
use App\Services\LeaseBillingService;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;

/** Landlord confirms (or rejects) tenants' "I've paid by EFT" notices. */
class EftPaymentsController extends Controller
{
    use ResolvesLandlord;

    /** POST /landlord/finance/eft/{eft}/confirm — money reflected: rent is paid. */
    public function confirm(Request $request, EftPayment $eft, LeaseBillingService $billing): RedirectResponse
    {
        $landlord = $this->resolveLandlord($request);
        $this->authorise($eft, $landlord);
        abort_unless($eft->status === 'submitted', 422, 'This EFT has already been reviewed.');

        $charge = $eft->rentPayment;
        $lease  = $eft->lease;

        if ($charge->status !== 'paid') {
            // Paid on time by EFT: no late penalty, even if one was added while it cleared.
            if ((float) $charge->late_fee > 0 && $eft->paid_on->endOfDay()->lte($billing->lateFeeDeadline($lease, $charge))) {
                $billing->waiveLateFee($charge);
                $charge->refresh();
            }

            $charge->update([
                'status'             => 'paid',
                'paid_at'            => CarbonImmutable::parse($eft->paid_on)->setTime(12, 0),
                'payment_method'     => 'manual',
                'paystack_reference' => 'EFT-' . str_pad((string) $eft->id, 6, '0', STR_PAD_LEFT),
            ]);
        }

        $eft->update(['status' => 'confirmed', 'reviewed_by' => $request->user()->id, 'reviewed_at' => now()]);

        try {
            if ($eft->tenant) {
                Notification::sendNow($eft->tenant, new EftPaymentReviewed($eft->fresh()));
                Notification::sendNow($eft->tenant, new RentPaymentReceived($charge->fresh()));
            }
        } catch (\Throwable $e) {
            report($e);
        }

        return back()->with('success', 'EFT confirmed. ' . ($eft->tenant?->name ?? 'The tenant') . "'s rent is marked paid.");
    }

    /** POST /landlord/finance/eft/{eft}/reject — not found in the account. */
    public function reject(Request $request, EftPayment $eft): RedirectResponse
    {
        $landlord = $this->resolveLandlord($request);
        $this->authorise($eft, $landlord);
        abort_unless($eft->status === 'submitted', 422, 'This EFT has already been reviewed.');

        $data = $request->validate(['reason' => ['required', 'string', 'max:300']]);

        $eft->update([
            'status' => 'rejected', 'reject_reason' => $data['reason'],
            'reviewed_by' => $request->user()->id, 'reviewed_at' => now(),
        ]);

        try {
            if ($eft->tenant) {
                Notification::sendNow($eft->tenant, new EftPaymentReviewed($eft->fresh()));
            }
        } catch (\Throwable $e) {
            report($e);
        }

        return back()->with('success', 'EFT marked as not received. The tenant has been told.');
    }

    /** GET /landlord/finance/eft/{eft}/proof — the tenant's proof of payment. */
    public function proof(Request $request, EftPayment $eft)
    {
        $landlord = $this->resolveLandlord($request);
        $this->authorise($eft, $landlord);
        abort_unless($eft->proof_path && Storage::disk('local')->exists($eft->proof_path), 404);

        return Storage::disk('local')->response($eft->proof_path);
    }

    private function authorise(EftPayment $eft, Landlord $landlord): void
    {
        abort_unless($landlord->listings()->whereKey($eft->lease?->listing_id)->exists(), 403);
    }
}
