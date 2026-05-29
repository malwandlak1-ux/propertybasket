<?php

namespace App\Http\Controllers\Contractor;

use App\Http\Controllers\Contractor\Concerns\ResolvesContractor;
use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    use ResolvesContractor;

    private const SPECIALITY_OPTIONS = [
        'plumbing', 'electrical', 'hvac', 'painting', 'carpentry',
        'roofing', 'tiling', 'landscaping', 'pool', 'pest_control',
        'locksmith', 'glazing', 'appliances', 'general',
    ];

    private const BANK_OPTIONS = [
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
    ];

    public function show(Request $request): Response
    {
        $contractor = $this->resolveContractor($request);
        $user       = $request->user();
        $banking    = $contractor->hasBankingDetails();

        return Inertia::render('Contractor/Settings', [
            'counts'     => $this->sidebarCounts($contractor),
            'contractor' => [
                'id'             => $contractor->id,
                'name'           => $user->name,
                'business_name'  => $contractor->business_name,
                'average_rating' => (float) ($contractor->average_rating ?? 0),
                'total_reviews'  => $contractor->total_reviews ?? 0,
                'total_jobs'     => $contractor->total_jobs ?? 0,
            ],
            'profile' => [
                'name'  => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
            ],
            'banking' => [
                'bank_name'               => $contractor->bank_name,
                'bank_account_holder'     => $contractor->bank_account_holder,
                'bank_account_number'     => $contractor->bank_account_number,
                'bank_branch_code'        => $contractor->bank_branch_code,
                'bank_account_type'       => $contractor->bank_account_type,
                'verified_at'             => $contractor->bank_verified_at?->format('d M Y'),
                'paystack_recipient_code' => $contractor->paystack_recipient_code,
                'state'                   => $contractor->bank_verified_at
                    ? 'verified'
                    : ($banking ? 'pending_review' : 'missing'),
            ],
            'portfolio' => [
                'bio'             => $contractor->bio,
                'business_name'   => $contractor->business_name,
                'trading_name'    => $contractor->trading_name,
                'specialities'    => $contractor->specialities ?? [],
                'service_areas'   => $contractor->service_areas ?? [],
                'portfolio_items' => $contractor->portfolio_items ?? [],
            ],
            'options' => [
                'banks'        => self::BANK_OPTIONS,
                'specialities' => self::SPECIALITY_OPTIONS,
            ],
        ]);
    }

    public function updateProfile(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'name'  => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:180', 'unique:users,email,' . $user->id],
            'phone' => ['nullable', 'string', 'max:30'],
        ]);

        $user->update($data);

        return back()->with('success', 'Login details updated.');
    }

    public function updatePassword(Request $request): RedirectResponse
    {
        $user = $request->user();

        $request->validate([
            'current_password' => ['required', 'current_password'],
            'password'         => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user->update(['password' => bcrypt($request->input('password'))]);

        return back()->with('success', 'Password updated.');
    }

    public function updateBanking(Request $request): RedirectResponse
    {
        $contractor = $this->resolveContractor($request);

        $data = $request->validate([
            'bank_name'           => ['required', 'string', 'max:120'],
            'bank_account_holder' => ['required', 'string', 'max:160'],
            'bank_account_number' => ['required', 'string', 'max:32'],
            'bank_branch_code'    => ['required', 'string', 'max:12'],
            'bank_account_type'   => ['required', 'in:cheque,current,savings'],
        ]);

        // Any change to the account details should drop platform verification and
        // the Paystack recipient code so the new account can be re-vetted.
        $changed = $contractor->bank_account_number !== $data['bank_account_number']
            || $contractor->bank_branch_code        !== $data['bank_branch_code']
            || $contractor->bank_name               !== $data['bank_name']
            || $contractor->bank_account_holder     !== $data['bank_account_holder'];

        $contractor->fill($data);
        if ($changed) {
            $contractor->bank_verified_at = null;
            $contractor->paystack_recipient_code = null;
        }
        $contractor->save();

        return back()->with('success', 'Banking details saved. Pending platform verification before payouts resume.');
    }

    public function updatePortfolio(Request $request): RedirectResponse
    {
        $contractor = $this->resolveContractor($request);

        $data = $request->validate([
            'bio'              => ['nullable', 'string', 'max:2000'],
            'business_name'    => ['required', 'string', 'max:160'],
            'trading_name'     => ['nullable', 'string', 'max:160'],
            'specialities'     => ['nullable', 'array'],
            'specialities.*'   => ['string', 'max:60'],
            'service_areas'    => ['nullable', 'array'],
            'service_areas.*'  => ['string', 'max:80'],
        ]);

        $contractor->update([
            'bio'           => $data['bio'] ?? null,
            'business_name' => $data['business_name'],
            'trading_name'  => $data['trading_name'] ?? null,
            'specialities'  => array_values(array_unique($data['specialities'] ?? [])),
            'service_areas' => array_values(array_filter(array_map('trim', $data['service_areas'] ?? []))),
        ]);

        return back()->with('success', 'Portfolio updated.');
    }

    public function uploadPortfolioPhoto(Request $request): RedirectResponse
    {
        $contractor = $this->resolveContractor($request);

        $request->validate([
            'photo'   => ['required', 'image', 'mimes:png,jpg,jpeg,webp', 'max:4096'],
            'caption' => ['nullable', 'string', 'max:160'],
        ]);

        $path = $request->file('photo')->store("contractors/{$contractor->id}/portfolio", 'public');

        $items   = $contractor->portfolio_items ?? [];
        $items[] = [
            'url'        => Storage::url($path),
            'path'       => $path,
            'caption'    => $request->input('caption'),
            'uploaded_at' => now()->toIso8601String(),
        ];

        $contractor->update(['portfolio_items' => $items]);

        return back()->with('success', 'Photo added to portfolio.');
    }

    public function deletePortfolioPhoto(Request $request, int $index): RedirectResponse
    {
        $contractor = $this->resolveContractor($request);

        $items = $contractor->portfolio_items ?? [];

        if (! array_key_exists($index, $items)) {
            return back()->with('error', 'Photo not found.');
        }

        $item = $items[$index];
        if (! empty($item['path'])) {
            Storage::disk('public')->delete($item['path']);
        }

        unset($items[$index]);
        $contractor->update(['portfolio_items' => array_values($items)]);

        return back()->with('success', 'Photo removed.');
    }
}
