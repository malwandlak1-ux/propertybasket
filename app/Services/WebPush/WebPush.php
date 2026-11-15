<?php

namespace App\Services\WebPush;

use App\Models\PushSubscription;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Web Push (RFC 8030) with VAPID (RFC 8292) and aes128gcm payload encryption
 * (RFC 8291), using only PHP's openssl. Lets the browser show a notification
 * through its service worker even when no Property Basket tab is open.
 *
 * The VAPID key pair comes from VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY, or is
 * generated once and kept in storage/app/webpush-vapid.json.
 */
class WebPush
{
    /** DER prefix of a P-256 SubjectPublicKeyInfo; append the 65-byte uncompressed point. */
    private const SPKI_PREFIX = '3059301306072a8648ce3d020106082a8648ce3d030107034200';

    // ── Sending ──────────────────────────────────────────────────────────

    /**
     * Push to every device the user switched alerts on for. Payload:
     * ['title' => …, 'body' => …, 'url' => '/agent/…', 'tag' => optional].
     * Returns how many devices accepted it. Gone subscriptions are removed.
     */
    public function toUser(User $user, array $payload): int
    {
        $ok = 0;
        foreach (PushSubscription::where('user_id', $user->id)->get() as $sub) {
            $ok += $this->send($sub, $payload) ? 1 : 0;
        }

        return $ok;
    }

    public function send(PushSubscription $sub, array $payload): bool
    {
        try {
            $body = $this->encrypt(json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $sub->p256dh, $sub->auth);
            $res = Http::timeout(10)->withHeaders([
                'Authorization'    => $this->vapidHeader($sub->endpoint),
                'Content-Encoding' => 'aes128gcm',
                'Content-Type'     => 'application/octet-stream',
                'TTL'              => '86400',
                'Urgency'          => 'high',
            ])->withBody($body, 'application/octet-stream')->post($sub->endpoint);
        } catch (\Throwable $e) {
            Log::warning('Web push failed', ['subscription' => $sub->id, 'error' => $e->getMessage()]);

            return false;
        }

        if (in_array($res->status(), [404, 410], true)) {
            $sub->delete(); // the browser unsubscribed or the subscription expired

            return false;
        }
        if (! $res->successful()) {
            Log::warning('Web push rejected', ['subscription' => $sub->id, 'status' => $res->status(), 'body' => mb_substr($res->body(), 0, 300)]);

            return false;
        }
        $sub->forceFill(['last_used_at' => now()])->save();

        return true;
    }

    // ── Encryption (RFC 8291, aes128gcm) ─────────────────────────────────

    /** Encrypt $plain for a subscription's p256dh / auth keys (base64url). */
    public function encrypt(string $plain, string $p256dh, string $auth, ?string $salt = null, $localKey = null): string
    {
        $uaPublic = self::b64d($p256dh);
        $authSecret = self::b64d($auth);
        if (strlen($uaPublic) !== 65 || strlen($authSecret) !== 16) {
            throw new RuntimeException('Invalid push subscription keys.');
        }

        $localKey ??= self::newKey();
        $asPublic = self::publicPoint($localKey);
        $shared = openssl_pkey_derive(self::publicKeyFromPoint($uaPublic), $localKey, 32);
        if ($shared === false) {
            throw new RuntimeException('ECDH failed.');
        }

        $ikm = hash_hkdf('sha256', $shared, 32, "WebPush: info\0" . $uaPublic . $asPublic, $authSecret);
        $salt ??= random_bytes(16);
        $cek = hash_hkdf('sha256', $ikm, 16, "Content-Encoding: aes128gcm\0", $salt);
        $nonce = hash_hkdf('sha256', $ikm, 12, "Content-Encoding: nonce\0", $salt);

        $tag = '';
        $cipher = openssl_encrypt($plain . "\x02", 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag);

        return $salt . pack('N', 4096) . chr(65) . $asPublic . $cipher . $tag;
    }

    // ── VAPID ────────────────────────────────────────────────────────────

    public function publicKey(): string
    {
        return $this->keys()['public'];
    }

    public function vapidHeader(string $endpoint): string
    {
        $parts = parse_url($endpoint);
        $aud = $parts['scheme'] . '://' . $parts['host'] . (isset($parts['port']) ? ':' . $parts['port'] : '');
        $subject = config('services.webpush.subject') ?: 'mailto:' . (config('mail.from.address') ?: 'info@propertybasket.co.za');

        $input = self::b64e(json_encode(['typ' => 'JWT', 'alg' => 'ES256']))
            . '.' . self::b64e(json_encode(['aud' => $aud, 'exp' => time() + 12 * 3600, 'sub' => $subject]));
        openssl_sign($input, $der, $this->privateKey(), OPENSSL_ALGO_SHA256);

        return 'vapid t=' . $input . '.' . self::b64e(self::derToRaw($der)) . ', k=' . $this->publicKey();
    }

    /** @return array{public:string, private:string} base64url raw public point + PEM private key */
    private function keys(): array
    {
        static $cache = null;
        if ($cache) {
            return $cache;
        }
        if (config('services.webpush.public_key') && config('services.webpush.private_key')) {
            return $cache = ['public' => config('services.webpush.public_key'), 'private' => self::pemFromEnv(config('services.webpush.private_key'))];
        }

        $file = storage_path('app/webpush-vapid.json');
        if (is_file($file) && ($k = json_decode((string) file_get_contents($file), true)) && ! empty($k['public'])) {
            return $cache = $k;
        }

        $key = self::newKey();
        openssl_pkey_export($key, $pem, null, self::cnf());
        $k = ['public' => self::b64e(self::publicPoint($key)), 'private' => $pem];
        @mkdir(dirname($file), 0775, true);
        file_put_contents($file, json_encode($k), LOCK_EX);
        @chmod($file, 0600);

        return $cache = $k;
    }

    private function privateKey()
    {
        return openssl_pkey_get_private($this->keys()['private']);
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    /** A fresh P-256 key. Windows PHP needs openssl.cnf pointed at explicitly. */
    public static function newKey()
    {
        $key = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC] + self::cnf());

        return $key ?: throw new RuntimeException('Could not create an EC key: ' . openssl_error_string());
    }

    /** openssl.cnf for key generation/export: found automatically on Linux, needed explicitly on Windows PHP. */
    private static function cnf(): array
    {
        static $opts = null;
        if ($opts !== null) {
            return $opts;
        }
        if (PHP_OS_FAMILY !== 'Windows') {
            return $opts = [];
        }
        foreach (array_filter([getenv('OPENSSL_CONF') ?: null, dirname(PHP_BINARY) . '/extras/ssl/openssl.cnf']) as $cnf) {
            if (is_file($cnf)) {
                return $opts = ['config' => $cnf];
            }
        }

        return $opts = [];
    }

    public static function publicPoint($key): string
    {
        $d = openssl_pkey_get_details($key)['ec'];

        return "\x04" . str_pad($d['x'], 32, "\0", STR_PAD_LEFT) . str_pad($d['y'], 32, "\0", STR_PAD_LEFT);
    }

    public static function publicKeyFromPoint(string $point)
    {
        $pem = "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode(hex2bin(self::SPKI_PREFIX) . $point), 64, "\n") . "-----END PUBLIC KEY-----\n";

        return openssl_pkey_get_public($pem);
    }

    /** ES256 signatures come back DER-encoded; JWT wants raw r||s (64 bytes). */
    private static function derToRaw(string $der): string
    {
        $pos = 2;
        if (ord($der[1]) & 0x80) {
            $pos += ord($der[1]) & 0x7f;
        }
        $out = '';
        for ($i = 0; $i < 2; $i++) {
            $len = ord($der[$pos + 1]);
            $int = substr($der, $pos + 2, $len);
            $out .= str_pad(ltrim($int, "\0"), 32, "\0", STR_PAD_LEFT);
            $pos += 2 + $len;
        }

        return $out;
    }

    /** VAPID_PRIVATE_KEY may be a PEM, or a PEM with literal \n escapes (single-line .env). */
    private static function pemFromEnv(string $v): string
    {
        return str_replace('\n', "\n", $v);
    }

    public static function b64e(string $bin): string
    {
        return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
    }

    public static function b64d(string $s): string
    {
        return (string) base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4));
    }
}
