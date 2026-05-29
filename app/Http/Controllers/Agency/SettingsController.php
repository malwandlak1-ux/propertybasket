<?php

namespace App\Http\Controllers\Agency;

use App\Http\Controllers\Agency\Concerns\ResolvesAgency;
use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    use ResolvesAgency;

    public function show(Request $request): Response
    {
        $agency = $this->resolveAgency($request);

        return Inertia::render('Agency/Settings', [
            'agency' => [
                'id' => $agency->id,
                'name' => $agency->name,
                'slug' => $agency->slug,
                'email' => $agency->email,
                'phone' => $agency->phone,
                'head_office_address' => $agency->head_office_address,
                'website' => $agency->website,
                'logo' => $agency->logo,
                'eaab_ffc_number' => $agency->eaab_ffc_number,
                'eaab_verified_at' => $agency->eaab_verified_at?->toDateString(),
                'vat_registered' => (bool) $agency->vat_registered,
                'vat_number' => $agency->vat_number,
                'vat_rate' => (float) $agency->vat_rate,
                'trust_bank' => $agency->trust_bank,
                'trust_account_number' => $agency->trust_account_number,
                'trust_branch_code' => $agency->trust_branch_code,
                'payout_day' => (int) ($agency->payout_day ?? 25),
                'paystack_subaccount_code' => $agency->paystack_subaccount_code,
            ],
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $agency = $this->resolveAgency($request);

        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:160'],
            'email' => ['nullable', 'email', 'max:180'],
            'phone' => ['nullable', 'string', 'max:30'],
            'website' => ['nullable', 'url', 'max:200'],
            'head_office_address' => ['nullable', 'string', 'max:240'],
            'logo' => ['nullable', 'image', 'mimes:png,jpg,jpeg,webp,svg', 'max:2048'],

            'vat_registered' => ['required', 'boolean'],
            'vat_number' => ['nullable', 'string', 'max:40'],
            'vat_rate' => ['required', 'numeric', 'min:0', 'max:100'],

            'trust_bank' => ['nullable', 'string', 'max:80'],
            'trust_account_number' => ['nullable', 'string', 'max:40'],
            'trust_branch_code' => ['nullable', 'string', 'max:20'],

            'payout_day' => ['required', 'integer', 'min:1', 'max:28'],
            'eaab_ffc_number' => ['nullable', 'string', 'max:60'],
        ]);

        if ($request->hasFile('logo')) {
            // Replace any existing logo to keep storage tidy.
            if ($agency->logo) {
                $relative = preg_replace('#^/?storage/#', '', parse_url($agency->logo, PHP_URL_PATH) ?? $agency->logo);
                if ($relative) {
                    Storage::disk('public')->delete($relative);
                }
            }
            $path = $request->file('logo')->store("agencies/{$agency->id}", 'public');
            $data['logo'] = Storage::url($path);
        } else {
            // Don't overwrite the existing logo when no new file is uploaded.
            unset($data['logo']);
        }

        $agency->fill($data)->save();

        return back()->with('success', 'Settings saved.');
    }
}
