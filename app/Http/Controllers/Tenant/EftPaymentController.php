<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Tenant\Concerns\ResolvesTenant;
use App\Models\EftPayment;
use App\Models\RentPayment;
use App\Notifications\EftPaymentSubmitted;
use App\Services\LeaseBillingService;
use App\Services\RentPayee;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\Rule;

class EftPaymentController extends Controller
{
    use ResolvesTenant;

    /**
     * POST /tenant/payments/eft — the tenant tells us they paid a month's rent
     * by EFT (with optional proof). The rent stays unpaid until whoever
     * manages the lease confirms the money arrived.
     */
    public function store(Request $request, RentPayee $payee): RedirectResponse
    {
        $lease = $this->resolveLease($request);

        $data = $request->validate([
            'rent_payment_id' => ['required', 'integer', Rule::exists('rent_payments', 'id')->where('lease_id', $lease->id)],
            'amount'          => ['required', 'numeric', 'min:1', 'max:10000000'],
            'paid_on'         => ['required', 'date', 'before_or_equal:today', 'after_or_equal:' . $lease->start_date->copy()->subMonth()->toDateString()],
            'proof'           => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
            'note'            => ['nullable', 'string', 'max:500'],
        ], [
            'proof.mimes' => 'Proof of payment must be a PDF, JPG or PNG.',
            'proof.max'   => 'Proof of payment must be 5 MB or smaller.',
        ]);

        $charge = RentPayment::findOrFail($data['rent_payment_id']);
        abort_unless(in_array($charge->status, LeaseBillingService::UNPAID, true), 422, 'This month is already paid.');

        if (EftPayment::where('rent_payment_id', $charge->id)->where('status', 'submitted')->exists()) {
            return back()->withErrors(['rent_payment_id' => 'You have already told us about an EFT for this month. It is waiting for confirmation.']);
        }

        $eft = EftPayment::create([
            'lease_id'        => $lease->id,
            'rent_payment_id' => $charge->id,
            'tenant_id'       => $request->user()->id,
            'amount'          => $data['amount'],
            'paid_on'         => $data['paid_on'],
            'reference'       => $payee->reference($lease),
            'note'            => $data['note'] ?? null,
            'status'          => 'submitted',
        ]);

        if ($request->hasFile('proof')) {
            $path = $request->file('proof')->store("eft-proofs/{$lease->id}", 'local');
            $eft->update(['proof_path' => $path]);
        }

        $lease->loadMissing(['landlord', 'agency.owner']);
        $manager = $lease->agency?->owner ?? $lease->landlord;
        try {
            if ($manager) {
                Notification::sendNow($manager, new EftPaymentSubmitted($eft->fresh()));
            }
        } catch (\Throwable $e) {
            report($e);
        }

        return back()->with('success', 'Thanks, we have let ' . ($lease->agency?->name ?? $lease->landlord?->name ?? 'your landlord') . ' know. Your rent shows as paid once they confirm the EFT has reflected.');
    }
}
