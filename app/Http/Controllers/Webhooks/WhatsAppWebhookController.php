<?php

namespace App\Http\Controllers\Webhooks;

use App\Http\Controllers\Controller;
use App\Models\WhatsAppAccount;
use App\Services\WhatsApp\WebhookHandler;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

/**
 * Meta WhatsApp webhooks, one callback URL per agent's number
 * (/webhooks/whatsapp/{key}) so each agent's own Meta app can be verified
 * with its own verify token and app secret.
 */
class WhatsAppWebhookController extends Controller
{
    /** GET — Meta's subscription handshake. */
    public function verify(Request $request, string $key): Response
    {
        $account = WhatsAppAccount::where('webhook_key', $key)->firstOrFail();

        if ($request->query('hub_mode') === 'subscribe'
            && hash_equals($account->verify_token, (string) $request->query('hub_verify_token'))) {
            return response((string) $request->query('hub_challenge'), 200, ['Content-Type' => 'text/plain']);
        }

        return response('Verification failed', 403);
    }

    /** POST — statuses, replies, quality and template updates. */
    public function receive(Request $request, string $key, WebhookHandler $handler): Response
    {
        $account = WhatsAppAccount::where('webhook_key', $key)->firstOrFail();
        $raw = $request->getContent();

        if (! WebhookHandler::validSignature($raw, $request->header('X-Hub-Signature-256'), $account->app_secret)) {
            Log::warning('WhatsApp webhook rejected: bad or missing signature', ['account' => $account->id]);

            return response('Invalid signature', 403);
        }

        try {
            // Numbers connected through the same Meta app share this callback: route each entry to its own number.
            $handler->route(json_decode($raw, true) ?? [], $account->app_secret, $account);
        } catch (\Throwable $e) {
            report($e); // still 200 so Meta doesn't retry a payload we can't process
        }

        return response('ok', 200);
    }

    /** GET /webhooks/whatsapp/platform — handshake for the platform's own Meta app. */
    public function verifyPlatform(Request $request): Response
    {
        $token = (string) config('whatsapp.platform_verify_token');
        if ($token !== '' && $request->query('hub_mode') === 'subscribe'
            && hash_equals($token, (string) $request->query('hub_verify_token'))) {
            return response((string) $request->query('hub_challenge'), 200, ['Content-Type' => 'text/plain']);
        }

        return response('Verification failed', 403);
    }

    /** POST /webhooks/whatsapp/platform — deliveries for every number connected with "Connect WhatsApp". */
    public function receivePlatform(Request $request, WebhookHandler $handler): Response
    {
        $raw = $request->getContent();
        $secret = (string) config('whatsapp.app_secret');
        if (! WebhookHandler::validSignature($raw, $request->header('X-Hub-Signature-256'), $secret)) {
            Log::warning('WhatsApp platform webhook rejected: bad or missing signature');

            return response('Invalid signature', 403);
        }
        try {
            $handler->route(json_decode($raw, true) ?? [], $secret);
        } catch (\Throwable $e) {
            report($e);
        }

        return response('ok', 200);
    }
}
