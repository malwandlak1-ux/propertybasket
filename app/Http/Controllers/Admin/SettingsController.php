<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\EnsuresSuperAdmin;
use App\Models\PlatformSetting;
use App\Support\PlatformPlans;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    use EnsuresSuperAdmin;

    private const SETTING_KEY = 'platform_settings';

    public function index(Request $request): Response
    {
        $this->ensureSuperAdmin($request);

        $tabs = [
            ['key' => 'general',      'label' => 'General'],
            ['key' => 'appearance',   'label' => 'Appearance'],
            ['key' => 'fees',         'label' => 'Fees & Commissions'],
            ['key' => 'paystack',     'label' => 'Paystack / Integrations'],
            ['key' => 'cities',       'label' => 'Cities & Areas'],
            ['key' => 'advanced',     'label' => 'Advanced'],
        ];

        $settings = $this->loadSettings();

        $currencies = [
            ['code' => 'ZAR', 'label' => 'ZAR (R)'],
            ['code' => 'USD', 'label' => 'USD ($)'],
            ['code' => 'EUR', 'label' => 'EUR (€)'],
            ['code' => 'GBP', 'label' => 'GBP (£)'],
        ];

        return Inertia::render('Admin/Settings', [
            'counts'     => $this->sidebarCounts(),
            'tabs'       => $tabs,
            'settings'   => $settings,
            'currencies' => $currencies,
            'has_overrides' => PlatformSetting::where('key', self::SETTING_KEY)->exists(),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $this->ensureSuperAdmin($request);

        $validated = $request->validate([
            // General
            'general.platform_name'    => ['required', 'string', 'max:80'],
            'general.support_email'    => ['required', 'email', 'max:160'],
            'general.default_currency' => ['required', 'string', 'in:ZAR,USD,EUR,GBP'],
            'general.default_vat_rate' => ['required', 'numeric', 'min:0', 'max:100'],

            // Fees
            'fees.contractor_platform_fee' => ['required', 'numeric', 'min:0', 'max:50'],
            'fees.absorb_paystack_fees'    => ['required', 'boolean'],
            'fees.free_trial_days'         => ['required', 'integer', 'min:0', 'max:365'],

            // Paystack — only the user-toggleable bits. Webhook URL and key
            // presence are derived from env, never set from the panel.
            'paystack.live_mode' => ['required', 'boolean'],

            // Cities — editable list of active provinces and cities. Optional
            // so tabs that didn't change don't need to round-trip them.
            'cities'                       => ['sometimes', 'array'],
            'cities.enabled_provinces'     => ['sometimes', 'array', 'max:50'],
            'cities.enabled_provinces.*'   => ['required', 'string', 'max:60'],
            'cities.enabled_cities'        => ['sometimes', 'array', 'max:200'],
            'cities.enabled_cities.*'      => ['required', 'string', 'max:60'],

            // Advanced
            'advanced.maintenance_mode'    => ['required', 'boolean'],
            'advanced.allow_signups'       => ['required', 'boolean'],
            'advanced.enforce_eaab_check'  => ['required', 'boolean'],
            'advanced.enforce_fica_check'  => ['required', 'boolean'],
            'advanced.tenant_invites_only' => ['required', 'boolean'],
        ]);

        // Normalize cities: trim, drop empties, dedupe (case-insensitive).
        $existing = $this->loadSettings();
        $cities   = $existing['cities'];
        if (isset($validated['cities']['enabled_provinces'])) {
            $cities['enabled_provinces'] = $this->normalizeList($validated['cities']['enabled_provinces']);
        }
        if (isset($validated['cities']['enabled_cities'])) {
            $cities['enabled_cities'] = $this->normalizeList($validated['cities']['enabled_cities']);
        }

        // Merge over the existing payload so any non-user-editable fields
        // (paystack.webhook_url, *_key_set) survive unchanged.
        $merged = [
            'general'   => array_merge($existing['general'], $validated['general']),
            'fees'      => array_merge($existing['fees'], $validated['fees']),
            'paystack'  => array_merge($existing['paystack'], $validated['paystack']),
            'cities'    => $cities,
            'advanced'  => array_merge($existing['advanced'], $validated['advanced']),
        ];

        PlatformSetting::set(self::SETTING_KEY, $merged);

        return back()->with('success', 'Platform settings saved.');
    }

    public function reset(Request $request): RedirectResponse
    {
        $this->ensureSuperAdmin($request);

        PlatformSetting::forget(self::SETTING_KEY);

        return back()->with('success', 'Platform settings reset to defaults.');
    }

    /**
     * Load settings from the platform_settings table, merged on top of the
     * hardcoded defaults so the page always has a complete dict to render —
     * even if the saved blob is missing newer keys.
     */
    private function loadSettings(): array
    {
        $defaults = $this->defaults();
        $stored = PlatformSetting::get(self::SETTING_KEY);

        if (! is_array($stored)) {
            return $defaults;
        }

        return [
            'general'   => array_merge($defaults['general'],   $stored['general']   ?? []),
            'fees'      => array_merge($defaults['fees'],      $stored['fees']      ?? []),
            'paystack'  => array_merge($defaults['paystack'],  $stored['paystack']  ?? []),
            'cities'    => array_merge($defaults['cities'],    $stored['cities']    ?? []),
            'advanced'  => array_merge($defaults['advanced'],  $stored['advanced']  ?? []),
        ];
    }

    /**
     * Trim entries, drop empties, dedupe case-insensitively while preserving order.
     *
     * @param  array<int, string>  $items
     * @return array<int, string>
     */
    private function normalizeList(array $items): array
    {
        $seen = [];
        $out  = [];
        foreach ($items as $raw) {
            $value = trim((string) $raw);
            if ($value === '') continue;

            $key = mb_strtolower($value);
            if (isset($seen[$key])) continue;

            $seen[$key] = true;
            $out[] = $value;
        }
        return $out;
    }

    /**
     * Baseline defaults. Used on first render and as the Reset target.
     */
    private function defaults(): array
    {
        return [
            'general' => [
                'platform_name'    => 'Property Basket',
                'support_email'    => 'support@propertybasket.co.za',
                'default_currency' => 'ZAR',
                'default_vat_rate' => 15,
            ],
            'fees' => [
                'contractor_platform_fee' => PlatformPlans::CONTRACTOR_FEE_PERCENT,
                'absorb_paystack_fees'    => true,
                'free_trial_days'         => 14,
            ],
            'paystack' => [
                'live_mode'      => false,
                'webhook_url'    => url('/webhooks/paystack'),
                'public_key_set' => ! empty(config('services.paystack.public_key')),
                'secret_key_set' => ! empty(config('services.paystack.secret_key')),
            ],
            'cities' => [
                'enabled_provinces' => ['Gauteng', 'Western Cape', 'KwaZulu-Natal'],
                'enabled_cities'    => ['Johannesburg', 'Cape Town', 'Durban', 'Pretoria', 'Stellenbosch', 'Franschhoek'],
            ],
            'advanced' => [
                'maintenance_mode'    => false,
                'allow_signups'       => true,
                'enforce_eaab_check'  => true,
                'enforce_fica_check'  => true,
                'tenant_invites_only' => true,
            ],
        ];
    }
}
