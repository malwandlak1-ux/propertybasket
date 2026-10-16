<?php

/*
| Meta WhatsApp Cloud API webhooks — loaded by AppServiceProvider without the
| web middleware (no session, cookies or CSRF). Requests are authenticated by
| the per-agent URL key + Meta's X-Hub-Signature-256 HMAC.
*/

use App\Http\Controllers\Webhooks\WhatsAppWebhookController;
use Illuminate\Support\Facades\Route;

Route::get('{key}', [WhatsAppWebhookController::class, 'verify'])->where('key', '[a-z0-9]{32}')->name('verify');
Route::post('{key}', [WhatsAppWebhookController::class, 'receive'])->where('key', '[a-z0-9]{32}')->name('receive');
