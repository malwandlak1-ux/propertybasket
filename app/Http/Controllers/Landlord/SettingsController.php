<?php

namespace App\Http\Controllers\Landlord;

use App\Http\Controllers\Landlord\Concerns\ResolvesLandlord;
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
}
