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

    'disabled_roles' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('DISABLED_ROLES', ''))
    ))),
];
