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
            'api_keys'  => \App\Models\ApiKey::where('landlord_id', $landlord->id)->latest('id')->get()
                ->map(fn ($k) => [
                    'id'           => $k->id,
                    'name'         => $k->name,
                    'prefix'       => $k->prefix,
                    'created_at'   => $k->created_at?->format('d M Y'),
                    'last_used_at' => $k->last_used_at?->diffForHumans(),
                    'revoked'      => $k->revoked_at !== null,
                ])->values(),
            // Shown once, straight after creating a key.
            'new_api_key' => $request->session()->get('new_api_key'),
            'api_base_url' => url('/api/integration/v1'),
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

        // Any change to the account details should drop platform verification —
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

    /** POST /landlord/settings/api-keys — create an integration API key (shown once). */
    public function storeApiKey(Request $request): RedirectResponse
    {
        $landlord = $this->resolveLandlord($request);
        $data = $request->validate(['name' => ['required', 'string', 'max:80']]);

        abort_if(\App\Models\ApiKey::where('landlord_id', $landlord->id)->whereNull('revoked_at')->count() >= 10, 422, 'You can have at most 10 active API keys.');

        [, $plain] = \App\Models\ApiKey::issue($landlord, $data['name'], $request->user()->id);

        return back()
            ->with('new_api_key', $plain)
            ->with('success', 'API key created. Copy it now: it will not be shown again.');
    }

    /** DELETE /landlord/settings/api-keys/{apiKey} — revoke (stops working immediately). */
    public function revokeApiKey(Request $request, \App\Models\ApiKey $apiKey): RedirectResponse
    {
        $landlord = $this->resolveLandlord($request);
        abort_unless($apiKey->landlord_id === $landlord->id, 404);

        $apiKey->update(['revoked_at' => now()]);

        return back()->with('success', "API key \"{$apiKey->name}\" revoked.");
    }
}
