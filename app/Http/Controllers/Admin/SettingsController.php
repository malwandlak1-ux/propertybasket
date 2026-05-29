<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\EnsuresSuperAdmin;
use App\Support\PlatformPlans;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    use EnsuresSuperAdmin;

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

        // Stubbed config — in a real implementation these would come from a
        // `platform_settings` table or config/platform.php.
        $settings = [
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
                'live_mode'        => false,
                'webhook_url'      => url('/webhooks/paystack'),
                'public_key_set'   => true,
                'secret_key_set'   => true,
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
        ]);
    }

    public function update(Request $request): \Illuminate\Http\RedirectResponse
    {
        $this->ensureSuperAdmin($request);
        // Stub — real implementation would validate per tab and persist.
        return back()->with('status', 'Settings saved (stub).');
    }
}
