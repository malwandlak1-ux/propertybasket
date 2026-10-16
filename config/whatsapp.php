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

    // Business-initiated sends only go out inside this window (SAST).
    'send_window' => [env('WHATSAPP_SEND_FROM', '08:00'), env('WHATSAPP_SEND_UNTIL', '19:00')],

    // Don't send the same number another campaign message within N days.
    'frequency_days' => (int) env('WHATSAPP_FREQUENCY_DAYS', 30),

    // Messages sent per dispatcher run (cron every minute / after requests).
    'per_tick'         => (int) env('WHATSAPP_PER_TICK', 120),
    'per_request_tick' => (int) env('WHATSAPP_PER_REQUEST_TICK', 40),

    // Run the dispatcher after web requests when no scheduler cron is set up.
    'run_on_requests' => (bool) env('WHATSAPP_RUN_ON_REQUESTS', true),
];
