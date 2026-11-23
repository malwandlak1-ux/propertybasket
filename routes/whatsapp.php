<?php

/*
| Meta WhatsApp Cloud API webhooks — loaded by AppServiceProvider without the
| web middleware (no session, cookies or CSRF). Requests are authenticated by
| the per-agent URL key + Meta's X-Hub-Signature-256 HMAC.
*/

use App\Http\Controllers\Webhooks\WhatsAppWebhookController;
use Illuminate\Support\Facades\Route;

// One URL for the platform's own Meta app (numbers connected with "Connect WhatsApp").
Route::get('platform', [WhatsAppWebhookController::class, 'verifyPlatform'])->name('platform.verify');
Route::post('platform', [WhatsAppWebhookController::class, 'receivePlatform'])->name('platform.receive');

Route::get('{key}', [WhatsAppWebhookController::class, 'verify'])->where('key', '[a-z0-9]{32}')->name('verify');
Route::post('{key}', [WhatsAppWebhookController::class, 'receive'])->where('key', '[a-z0-9]{32}')->name('receive');
