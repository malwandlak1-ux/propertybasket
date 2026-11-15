<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\PushSubscription;
use App\Models\User;
use App\Services\WebPush\WebPush;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** Web push: alerts reach a user's devices even when the site is closed. */
class WebPushTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    /** A fake browser's key pair + auth secret, as PushManager would create them. */
    private $uaKey;

    private string $p256dh;

    private string $auth;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->user = User::factory()->create(['role' => Role::Agent, 'status' => UserStatus::Active]);
        $this->user->assignRole('agent');
        config(['services.webpush.public_key' => null, 'services.webpush.private_key' => null]);
        @unlink(storage_path('app/webpush-vapid.json'));

        $this->uaKey = WebPush::newKey();
        $this->p256dh = WebPush::b64e(WebPush::publicPoint($this->uaKey));
        $this->auth = WebPush::b64e(random_bytes(16));
    }

    protected function tearDown(): void
    {
        @unlink(storage_path('app/webpush-vapid.json'));
        parent::tearDown();
    }

    /** Decrypt an aes128gcm body the way the browser does (RFC 8291). */
    private function decrypt(string $body): string
    {
        $salt = substr($body, 0, 16);
        $idlen = ord($body[20]);
        $asPublic = substr($body, 21, $idlen);
        $cipher = substr($body, 21 + $idlen);
        $shared = openssl_pkey_derive(WebPush::publicKeyFromPoint($asPublic), $this->uaKey, 32);
        $ikm = hash_hkdf('sha256', $shared, 32, "WebPush: info\0" . WebPush::b64d($this->p256dh) . $asPublic, WebPush::b64d($this->auth));
        $cek = hash_hkdf('sha256', $ikm, 16, "Content-Encoding: aes128gcm\0", $salt);
        $nonce = hash_hkdf('sha256', $ikm, 12, "Content-Encoding: nonce\0", $salt);
        $plain = openssl_decrypt(substr($cipher, 0, -16), 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, substr($cipher, -16));
        $this->assertNotFalse($plain, 'payload did not decrypt');

        return rtrim($plain, "\x02");
    }

    private function subscribe(string $endpoint = 'https://fcm.googleapis.com/fcm/send/abc123'): void
    {
        $this->actingAs($this->user)->postJson('/push/subscriptions', ['endpoint' => $endpoint, 'keys' => ['p256dh' => $this->p256dh, 'auth' => $this->auth]])
            ->assertOk();
    }

    #[Test]
    public function payloads_are_encrypted_so_only_the_device_can_read_them(): void
    {
        $body = app(WebPush::class)->encrypt('{"title":"Hi"}', $this->p256dh, $this->auth);
        $this->assertSame('{"title":"Hi"}', $this->decrypt($body));
        $this->assertSame(4096, unpack('N', substr($body, 16, 4))[1]);
    }

    #[Test]
    public function a_bell_notification_is_pushed_to_the_users_devices(): void
    {
        Http::fake(['fcm.googleapis.com/*' => Http::response('', 201)]);
        $this->actingAs($this->user)->getJson('/push/key')->assertOk()->assertJsonStructure(['key']);
        $this->subscribe();
        $this->assertSame(1, PushSubscription::where('user_id', $this->user->id)->count());

        $this->user->notify(new class extends Notification {
            public function via($n): array { return ['database']; }

            public function toArray($n): array { return ['x' => 1]; }
        });

        Http::assertSent(function (HttpRequest $r) {
            if (! str_starts_with($r->url(), 'https://fcm.googleapis.com/')) {
                return false;
            }
            $payload = json_decode($this->decrypt($r->body()), true);

            return $r->hasHeader('Content-Encoding', 'aes128gcm')
                && str_starts_with($r->header('Authorization')[0], 'vapid t=')
                && str_contains($r->header('Authorization')[0], 'k=' . app(WebPush::class)->publicKey())
                && $payload['url'] === '/dashboard' && str_starts_with($payload['tag'], 'n-') && $payload['title'] !== '';
        });
    }

    #[Test]
    public function the_vapid_token_is_a_valid_es256_signature(): void
    {
        $header = app(WebPush::class)->vapidHeader('https://updates.push.services.mozilla.com/wpush/v2/x');
        preg_match('/t=([^,]+), k=(.+)$/', $header, $m);
        [$h, $c, $sig] = explode('.', $m[1]);
        $claims = json_decode(WebPush::b64d($c), true);
        $this->assertSame('https://updates.push.services.mozilla.com', $claims['aud']);

        // Re-encode raw r||s as DER and verify with the public key.
        $raw = WebPush::b64d($sig);
        $int = fn ($b) => (ord(ltrim($b, "\0")[0] ?? "\0") & 0x80 ? "\0" : '') . ltrim($b, "\0");
        [$r, $s] = [$int(substr($raw, 0, 32)), $int(substr($raw, 32))];
        $seq = "\x02" . chr(strlen($r)) . $r . "\x02" . chr(strlen($s)) . $s;
        $der = "\x30" . chr(strlen($seq)) . $seq;
        $this->assertSame(1, openssl_verify("{$h}.{$c}", $der, WebPush::publicKeyFromPoint(WebPush::b64d($m[2])), OPENSSL_ALGO_SHA256));
    }

    #[Test]
    public function expired_subscriptions_are_removed_and_signing_out_stops_alerts(): void
    {
        Http::fake(['fcm.googleapis.com/*' => Http::response('', 410)]);
        $this->subscribe();
        $this->assertSame(0, app(WebPush::class)->toUser($this->user, ['title' => 'x']));
        $this->assertSame(0, PushSubscription::count());

        $this->subscribe('https://fcm.googleapis.com/fcm/send/device2');
        $this->assertSame(1, PushSubscription::count());
        $this->actingAs($this->user)->post('/logout')->assertRedirect();
        $this->assertSame(0, PushSubscription::count());
    }

    #[Test]
    public function the_switch_off_removes_only_this_device(): void
    {
        $this->subscribe('https://fcm.googleapis.com/fcm/send/a');
        $this->subscribe('https://fcm.googleapis.com/fcm/send/b');
        $this->actingAs($this->user)->deleteJson('/push/subscriptions', ['endpoint' => 'https://fcm.googleapis.com/fcm/send/a'])->assertOk();
        $this->assertSame(['https://fcm.googleapis.com/fcm/send/b'], PushSubscription::pluck('endpoint')->all());

        // Non-https endpoints are refused; guests can't subscribe.
        $this->actingAs($this->user)->postJson('/push/subscriptions', ['endpoint' => 'http://evil.test/x', 'keys' => ['p256dh' => $this->p256dh, 'auth' => $this->auth]])->assertStatus(422);
    }

    #[Test]
    public function the_app_manifest_and_service_worker_are_served(): void
    {
        $this->get('/manifest.webmanifest')->assertOk()->assertJsonPath('display', 'standalone')->assertJsonPath('start_url', '/dashboard');
        $this->get('/sw.js')->assertOk()->assertHeader('Service-Worker-Allowed', '/')->assertSee("addEventListener('push'", false);
        $this->postJson('/push/subscriptions', [])->assertUnauthorized();
    }
}
