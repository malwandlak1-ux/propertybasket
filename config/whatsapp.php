<?php

/*
| WhatsApp Cloud API (Meta) — CRM bulk messaging.
| Each agent connects their own WhatsApp Business account in CRM → WhatsApp;
| only platform-wide behaviour lives here.
*/

return [
    'graph_url'     => env('WHATSAPP_GRAPH_URL', 'https://graph.facebook.com'),
    'graph_version' => env('WHATSAPP_GRAPH_VERSION', 'v23.0'),

    // Fake every Meta call (local demos, tests). Never on in production.
    'stub' => (bool) env('WHATSAPP_STUB', false),

    // When campaign (direct-marketing) messages may go out, SAST. Defaults follow the
    // Consumer Protection Act regulations: Mon–Fri 08:00–20:00, Sat 09:00–13:00,
    // never Sundays or public holidays. Agents can narrow this per number, not widen it.
    'schedule' => [
        'weekdays'        => [env('WHATSAPP_WEEKDAY_FROM', '08:00'), env('WHATSAPP_WEEKDAY_UNTIL', '20:00')],
        'saturday'        => [env('WHATSAPP_SATURDAY_FROM', '09:00'), env('WHATSAPP_SATURDAY_UNTIL', '13:00')],
        'sunday'          => null,
        'public_holidays' => false,
    ],

    // Don't send the same number another campaign message within N days.
    'frequency_days' => (int) env('WHATSAPP_FREQUENCY_DAYS', 30),

    // Messages sent per dispatcher run (cron every minute / after requests).
    'per_tick'         => (int) env('WHATSAPP_PER_TICK', 120),
    'per_request_tick' => (int) env('WHATSAPP_PER_REQUEST_TICK', 40),

    // Run the dispatcher after web requests when no scheduler cron is set up.
    'run_on_requests' => (bool) env('WHATSAPP_RUN_ON_REQUESTS', true),
];
