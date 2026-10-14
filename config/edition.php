<?php

/*
|--------------------------------------------------------------------------
| Site edition
|--------------------------------------------------------------------------
|
| One codebase serves several sites (manage, production, careline). A site
| can switch whole dashboards off via DISABLED_ROLES, e.g. careline runs
| without agencies and agents:
|
|   DISABLED_ROLES=agency_admin,agent
|
| Disabled roles get 404s on their dashboard routes, vanish from sign-up and
| from agency-related navigation. Empty (the default) = every role enabled.
|
*/

return [
    // false = no public property portal: '/', listings, advice, calculator…
    // redirect to the login screen (careline). Legal pages stay reachable.
    'public_site' => filter_var(env('PUBLIC_SITE', true), FILTER_VALIDATE_BOOL),

    // false = contractors only see jobs assigned to them: no open-job
    // marketplace and no self-claiming (careline). Default true.
    'contractor_marketplace' => filter_var(env('CONTRACTOR_MARKETPLACE', true), FILTER_VALIDATE_BOOL),

    // White-label branding for a client site (careline = Careline Clinic).
    // Unset = Property Basket. Logo/icon are paths under public/.
    //   BRAND_NAME="Careline Clinic"
    //   BRAND_LOGO=/images/brands/careline-clinic.png
    //   BRAND_ICON=/images/brands/careline-clinic-icon.png
    //   BRAND_COLOR=#2E8FA8   BRAND_COLOR_ALT=#8DC63F
    'brand' => [
        'name'      => env('BRAND_NAME') ?: 'Property Basket',
        'logo'      => env('BRAND_LOGO') ?: null,
        'icon'      => env('BRAND_ICON') ?: null,
        'color'     => env('BRAND_COLOR') ?: '#F26A1B',
        'color_alt' => env('BRAND_COLOR_ALT') ?: null,
        // Dashboard accent for users who haven't picked one (BRAND_ACCENT=teal).
        'accent'    => env('BRAND_ACCENT') ?: 'orange',
    ],

    // Properties a self-managing landlord can hold (careline: 20).
    'landlord_property_slots' => (int) (env('LANDLORD_PROPERTY_SLOTS') ?: 5),

    'disabled_roles' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('DISABLED_ROLES', ''))
    ))),
];
