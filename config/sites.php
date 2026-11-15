<?php

/*
| Agency websites (generated sites linked to the dashboards).
|
| Every host that is NOT one of `main_hosts` is treated as a possible agency
| site: either "{subdomain}.{base_domain}" or a live custom domain.
| Locally, *.localhost resolves to 127.0.0.1, so
| http://sandton-realty.localhost:8090 works without touching DNS.
*/

$appHost = parse_url((string) env('APP_URL', 'http://localhost'), PHP_URL_HOST) ?: 'localhost';
$base = env('SITES_BASE_DOMAIN', $appHost);

return [
    'enabled' => (bool) env('SITES_ENABLED', true),

    'base_domain' => $base,

    // Hosts that always serve the normal Property Basket app.
    'main_hosts' => array_values(array_filter(array_map('trim', explode(',', (string) env(
        'SITES_MAIN_HOSTS',
        implode(',', [$base, $appHost, 'www.'.$base, 'manage.'.$base, 'careline.'.$base, '127.0.0.1', 'localhost'])
    ))))),

    // Used when building absolute links to a site ("View site" button).
    'scheme' => env('SITES_SCHEME', str_starts_with((string) env('APP_URL', ''), 'https') ? 'https' : 'http'),
    'port' => env('SITES_PORT'),

    // What agencies point their custom domain at.
    'cname_target' => env('SITES_CNAME_TARGET', 'sites.'.$base),
    'server_ip' => env('SITES_SERVER_IP'),
];
