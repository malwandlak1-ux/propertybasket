<?php

namespace App\Http\Controllers\Landlord;

use App\Http\Controllers\Landlord\Concerns\ResolvesLandlord;
use App\Models\Lease;
use App\Models\Landlord;
use App\Models\RentPayment;
use App\Services\LeaseBillingService;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    use ResolvesLandlord;

    public function show(Request $request): Response
    {
        $landlord = $this->resolveLandlord($request);
        $user     = $request->user();

        $bankingComplete = $landlord->hasBankingDetails();

        return Inertia::render('Landlord/Settings', [
            'landlord' => [
                'id'   => $landlord->id,
                'name' => $user->name,
            ],
            'profile' => [
                'name'      => $user->name,
                'email'     => $user->email,
                'phone'     => $user->phone,
                'id_number' => $landlord->id_number,
            ],
            'banking' => [
                'bank_name'           => $landlord->bank_name,
                'bank_account_holder' => $landlord->bank_account_holder,
                'bank_account_number' => $landlord->bank_account_number,
                'bank_branch_code'    => $landlord->bank_branch_code,
                'bank_account_type'   => $landlord->bank_account_type,
                'verified_at'         => $landlord->bank_verified_at?->format('d M Y'),
                'state'               => $landlord->bank_verified_at
                    ? 'verified'
                    : ($bankingComplete ? 'pending_review' : 'missing'),
            ],
            'penalties' => $this->penalties($landlord),
            'banks' => [
                'ABSA Bank',
                'Capitec Bank',
                'Discovery Bank',
                'First National Bank (FNB)',
                'Investec',
                'Nedbank',
                'Standard Bank',
                'TymeBank',
                'African Bank',
                'Bidvest Bank',
            ],
        ]);
    }

    public function updateProfile(Request $request): RedirectResponse
    {
        $landlord = $this->resolveLandlord($request);
        $user     = $request->user();

        $data = $request->validate([
            'name'      => ['required', 'string', 'max:120'],
            'email'     => ['required', 'email', 'max:180', 'unique:users,email,' . $user->id],
            'phone'     => ['nullable', 'string', 'max:30'],
            'id_number' => ['nullable', 'string', 'max:32'],
        ]);

        $user->update([
            'name'  => $data['name'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? null,
        ]);

        $landlord->update(['id_number' => $data['id_number'] ?? null]);

        return back()->with('success', 'Profile updated.');
    }

    public function updateBanking(Request $request): RedirectResponse
    {
        $landlord = $this->resolveLandlord($request);

        $data = $request->validate([
            'bank_name'           => ['required', 'string', 'max:120'],
            'bank_account_holder' => ['required', 'string', 'max:160'],
            'bank_account_number' => ['required', 'string', 'max:32'],
            'bank_branch_code'    => ['required', 'string', 'max:12'],
            'bank_account_type'   => ['required', 'in:cheque,current,savings'],
        ]);

        // Any change to the account details should drop platform verification â€”
        // the new account needs to be re-vetted before payouts can resume.
        $changed = $landlord->bank_account_number !== $data['bank_account_number']
            || $landlord->bank_branch_code    !== $data['bank_branch_code']
            || $landlord->bank_name           !== $data['bank_name']
            || $landlord->bank_account_holder !== $data['bank_account_holder'];

        $landlord->fill($data);
        if ($changed) {
            $landlord->bank_verified_at = null;
        }
        $landlord->save();

        return back()->with('success', 'Banking details saved. Pending platform verification before payouts resume.');
    }

    /** Leases on this landlord's portfolio, with their late-payment penalty terms. */
    private function penalties(Landlord $landlord): array
    {
        $billing = app(LeaseBillingService::class);

        return $this->portfolioLeases($landlord)
            ->with(['listing:id,title,address', 'tenant:id,name'])
            ->orderBy('id')
            ->get()
            ->map(function (Lease $lease) use ($billing) {
                $billing->ensureCharges($lease);

                $applied = RentPayment::where('lease_id', $lease->id)
                    ->where('late_fee', '>', 0)
                    ->orderByDesc('period_month')
                    ->take(6)
                    ->get()
                    ->map(fn (RentPayment $p) => [
                        'id'           => $p->id,
                        'period_label' => CarbonImmutable::parse($p->period_month . '-01')->format('F Y'),
                        'late_fee'     => (float) $p->late_fee,
                        'status'       => $p->status,
                        'applied_at'   => $p->late_fee_applied_at?->format('d M Y'),
                        'can_waive'    => $p->status !== 'paid',
                    ])->values();

                return [
                    'lease_id'     => $lease->id,
                    'property'     => $lease->listing?->address ?: $lease->listing?->title ?: 'Property',
                    'tenant'       => $lease->tenant?->name,
                    'monthly_rent' => (float) $lease->monthly_rent,
                    'enabled'      => (bool) $lease->late_fee_enabled,
                    'type'         => $lease->late_fee_type ?: 'percent',
                    'value'        => (float) $lease->late_fee_value,
                    'day'          => (int) ($lease->late_fee_day ?: 7),
                    'since'        => $lease->late_fee_since?->format('d M Y'),
                    'summary'      => $lease->lateFeeSummary(),
                    'applied'      => $applied,
                ];
            })
            ->values()
            ->all();
    }

    private function portfolioLeases(Landlord $landlord)
    {
        return Lease::whereIn('listing_id', $landlord->listings()->pluck('id'))
            ->whereIn('status', ['active', 'pending']);
    }

    /** PATCH /landlord/settings/penalties/{lease} — late-payment penalty terms for one property. */
    public function updatePenalty(Request $request, Lease $lease): RedirectResponse
    {
        $landlord = $this->resolveLandlord($request);
        abort_unless($this->portfolioLeases($landlord)->whereKey($lease->id)->exists(), 403);

        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'type'    => ['required', 'in:percent,fixed'],
            'value'   => ['required_if:enabled,true', 'numeric', 'min:0', $request->input('type') === 'percent' ? 'max:100' : 'max:1000000'],
            'day'     => ['required', 'integer', 'min:1', 'max:28'],
        ]);

        $enabled = (bool) $data['enabled'];
        if ($enabled && (float) $data['value'] <= 0) {
            return back()->withErrors(['value' => 'Enter the penalty amount from the lease agreement.']);
        }

        $lease->update([
            'late_fee_enabled' => $enabled,
            'late_fee_type'    => $data['type'],
            'late_fee_value'   => (float) ($data['value'] ?? 0),
            'late_fee_day'     => (int) $data['day'],
            // Penalties only count from the day they're switched on — never back-charged.
            'late_fee_since'   => $enabled
                ? ($lease->late_fee_enabled && $lease->late_fee_since ? $lease->late_fee_since : now()->toDateString())
                : null,
        ]);

        if ($enabled) {
            app(LeaseBillingService::class)->ensureCharges($lease->fresh());
        }

        return back()->with('success', $enabled
            ? 'Late payment penalty saved: ' . $lease->fresh()->lateFeeSummary() . '.'
            : 'Late payment penalties switched off for this property.');
    }

    /** POST /landlord/settings/penalties/charges/{payment}/waive */
    public function waivePenalty(Request $request, RentPayment $payment): RedirectResponse
    {
        $landlord = $this->resolveLandlord($request);
        abort_unless($this->portfolioLeases($landlord)->whereKey($payment->lease_id)->exists(), 403);
        abort_if($payment->status === 'paid' || (float) $payment->late_fee <= 0, 422, 'There is no unpaid penalty to waive.');

        app(LeaseBillingService::class)->waiveLateFee($payment);

        return back()->with('success', 'Penalty waived.');
    }
}
