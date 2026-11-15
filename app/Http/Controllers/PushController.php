<?php

namespace App\Http\Controllers;

use App\Models\PushSubscription;
use App\Services\WebPush\WebPush;
use App\Support\Edition;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Web push: the installable-app manifest, the service worker, and the
 * per-device on/off switch for notifications while the site is closed.
 */
class PushController extends Controller
{
    public function __construct(private WebPush $push) {}

    /** GET /push/key — the VAPID public key the browser subscribes with. */
    public function key(): JsonResponse
    {
        return response()->json(['key' => $this->push->publicKey()]);
    }

    /** POST /push/subscriptions — switch alerts on for this browser. */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'endpoint'    => ['required', 'url', 'starts_with:https://', 'max:2000'],
            'keys.p256dh' => ['required', 'string', 'max:200'],
            'keys.auth'   => ['required', 'string', 'max:100'],
        ]);
        $hash = PushSubscription::hashFor($data['endpoint']);

        // One row per browser: if someone else used to sign in here, it's now this user's.
        PushSubscription::updateOrCreate(['endpoint_hash' => $hash], [
            'user_id'    => $request->user()->id,
            'endpoint'   => $data['endpoint'],
            'p256dh'     => $data['keys']['p256dh'],
            'auth'       => $data['keys']['auth'],
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 255),
        ]);
        // Remembered so signing out stops alerts to this device.
        $request->session()->put('push_endpoint_hash', $hash);

        return response()->json(['ok' => true]);
    }

    /** DELETE /push/subscriptions — switch alerts off for this browser. */
    public function destroy(Request $request): JsonResponse
    {
        $endpoint = (string) $request->input('endpoint', '');
        PushSubscription::where('user_id', $request->user()->id)
            ->where('endpoint_hash', PushSubscription::hashFor($endpoint))->delete();
        $request->session()->forget('push_endpoint_hash');

        return response()->json(['ok' => true]);
    }

    /** POST /push/test — send a test alert to this user's devices. */
    public function test(Request $request): JsonResponse
    {
        $sent = $this->push->toUser($request->user(), [
            'title' => 'Notifications are on',
            'body'  => 'You’ll get alerts here for new leads, WhatsApp replies and more, even when ' . Edition::brand()['name'] . ' is closed.',
            'url'   => '/dashboard',
            'tag'   => 'push-test',
        ]);

        return response()->json(['sent' => $sent]);
    }

    /** GET /manifest.webmanifest — lets phones and computers install the site as an app. */
    public function manifest(): JsonResponse
    {
        $brand = Edition::brand();
        $icons = $brand['icon']
            ? [['src' => $brand['icon'], 'sizes' => 'any', 'type' => 'image/png', 'purpose' => 'any']]
            : [
                ['src' => '/images/pwa/icon-192.png', 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any'],
                ['src' => '/images/pwa/icon-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any'],
                ['src' => '/images/pwa/maskable-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'maskable'],
            ];

        return response()->json([
            'name'             => $brand['name'],
            'short_name'       => mb_substr($brand['name'], 0, 15),
            'id'               => '/',
            'start_url'        => '/dashboard',
            'scope'            => '/',
            'display'          => 'standalone',
            'background_color' => '#FFFFFF',
            'theme_color'      => $brand['color'],
            'icons'            => $icons,
        ], 200, ['Content-Type' => 'application/manifest+json']);
    }

    /** GET /sw.js — the service worker that shows alerts while the site is closed. */
    public function serviceWorker(): Response
    {
        return response(view('pwa.sw')->render(), 200, [
            'Content-Type'           => 'application/javascript; charset=utf-8',
            'Service-Worker-Allowed' => '/',
            'Cache-Control'          => 'no-cache',
        ]);
    }
}
