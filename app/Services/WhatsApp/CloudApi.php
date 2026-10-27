<?php

namespace App\Services\WhatsApp;

use App\Models\WhatsAppAccount;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Thin client for Meta's WhatsApp Cloud API (Graph API), using the agent's
 * own access token. Stub mode (config whatsapp.stub) fakes every call so
 * demos and tests run without Meta.
 */
class CloudApi
{
    public function isStub(): bool
    {
        return (bool) config('whatsapp.stub');
    }

    /** Phone number details: display number, verified name, quality rating. */
    public function phoneNumber(WhatsAppAccount $a): array
    {
        if ($this->isStub()) {
            return ['display_phone_number' => '+27 82 000 0000', 'verified_name' => 'Demo Agent', 'quality_rating' => 'GREEN', 'platform_type' => 'CLOUD_API'];
        }

        return $this->get($a, $a->phone_number_id, ['fields' => 'display_phone_number,verified_name,quality_rating,platform_type']);
    }

    /**
     * Register the number for the Cloud API (moves it from "Pending" to
     * "Connected" in WhatsApp Manager). The 6-digit PIN becomes the number's
     * two-step verification PIN.
     */
    public function register(WhatsAppAccount $a, string $pin): void
    {
        if ($this->isStub()) {
            return;
        }

        $this->post($a, "{$a->phone_number_id}/register", ['messaging_product' => 'whatsapp', 'pin' => $pin]);
    }

    /** Subscribe the app to the WhatsApp Business account so Meta sends it webhooks. */
    public function subscribeApp(WhatsAppAccount $a): void
    {
        if ($this->isStub()) {
            return;
        }

        $this->post($a, "{$a->waba_id}/subscribed_apps", []);
    }

    /** Every message template on the WhatsApp Business account. */
    public function templates(WhatsAppAccount $a): array
    {
        if ($this->isStub()) {
            return [
                [
                    'id' => 'stub-1', 'name' => 'home_value_report', 'language' => 'en', 'status' => 'APPROVED', 'category' => 'MARKETING',
                    'components' => [
                        ['type' => 'BODY', 'text' => "Hi {{1}}, I'm {{2}}, a property specialist focused on {{3}}. I put together free current-market value reports for local homeowners. Would you like one for your property?"],
                        ['type' => 'FOOTER', 'text' => 'Reply STOP to unsubscribe'],
                    ],
                ],
                [
                    'id' => 'stub-2', 'name' => 'new_listing_alert', 'language' => 'en', 'status' => 'APPROVED', 'category' => 'MARKETING',
                    'components' => [
                        ['type' => 'HEADER', 'format' => 'IMAGE'],
                        ['type' => 'BODY', 'text' => 'Hi {{1}}, a new listing just came up near you.'],
                    ],
                ],
            ];
        }

        $out = [];
        $query = ['limit' => 100, 'fields' => 'id,name,language,status,category,components'];
        $path = "{$a->waba_id}/message_templates";
        for ($page = 0; $page < 20; $page++) {
            $res = $this->get($a, $path, $query);
            array_push($out, ...($res['data'] ?? []));
            $after = $res['paging']['cursors']['after'] ?? null;
            if (! $after || empty($res['paging']['next'])) {
                break;
            }
            $query['after'] = $after;
        }

        return $out;
    }

    /** Submit a new template for Meta's review. Returns ['id', 'status', 'category']. */
    public function createTemplate(WhatsAppAccount $a, array $payload): array
    {
        if ($this->isStub()) {
            return ['id' => 'stub-' . Str::random(6), 'status' => 'PENDING', 'category' => $payload['category'] ?? 'MARKETING'];
        }

        return $this->post($a, "{$a->waba_id}/message_templates", $payload);
    }

    /** Send an approved template. Returns the WhatsApp message id (wamid). */
    public function sendTemplate(WhatsAppAccount $a, string $to, string $name, string $language, array $components): string
    {
        return $this->send($a, [
            'to'       => $to,
            'type'     => 'template',
            'template' => array_filter([
                'name'       => $name,
                'language'   => ['code' => $language],
                'components' => $components ?: null,
            ]),
        ]);
    }

    /**
     * Upload a file to Meta for this number; returns the media id to send.
     * Media ids are valid for 30 days.
     */
    public function uploadMedia(WhatsAppAccount $a, string $path, string $mime, string $filename): string
    {
        if ($this->isStub()) {
            return 'media-stub-' . Str::random(10);
        }

        $res = $this->handle(
            Http::withToken($a->access_token)->acceptJson()->timeout(120)
                ->attach('file', fopen($path, 'r'), $filename, ['Content-Type' => $mime])
                ->post($this->url("{$a->phone_number_id}/media"), ['messaging_product' => 'whatsapp', 'type' => $mime])
        );
        if (empty($res['id'])) {
            throw new WhatsAppApiException('Meta did not return a media id for the attachment.', 0);
        }

        return (string) $res['id'];
    }

    /**
     * Send an uploaded attachment (inside the 24h reply window).
     * $kind is image | video | audio | document; audio can't carry a caption.
     */
    public function sendMedia(WhatsAppAccount $a, string $to, string $kind, string $mediaId, ?string $caption = null, ?string $filename = null): string
    {
        $media = ['id' => $mediaId];
        if ($caption !== null && $caption !== '' && $kind !== 'audio') {
            $media['caption'] = $caption;
        }
        if ($kind === 'document' && $filename) {
            $media['filename'] = $filename;
        }

        return $this->send($a, ['to' => $to, 'type' => $kind, $kind => $media]);
    }

    /** Free-form text — only allowed within 24h of the owner's last message. */
    public function sendText(WhatsAppAccount $a, string $to, string $body): string
    {
        return $this->send($a, ['to' => $to, 'type' => 'text', 'text' => ['preview_url' => false, 'body' => $body]]);
    }

    private function send(WhatsAppAccount $a, array $message): string
    {
        if ($this->isStub()) {
            return 'wamid.STUB' . Str::upper(Str::random(24));
        }

        $res = $this->post($a, "{$a->phone_number_id}/messages", ['messaging_product' => 'whatsapp', 'recipient_type' => 'individual'] + $message);
        $id = $res['messages'][0]['id'] ?? null;
        if (! $id) {
            throw new WhatsAppApiException('Meta did not return a message id.', 0);
        }

        return $id;
    }

    private function get(WhatsAppAccount $a, string $path, array $query = []): array
    {
        return $this->handle(Http::withToken($a->access_token)->acceptJson()->timeout(20)->get($this->url($path), $query));
    }

    private function post(WhatsAppAccount $a, string $path, array $body): array
    {
        return $this->handle(Http::withToken($a->access_token)->acceptJson()->timeout(20)->post($this->url($path), $body));
    }

    private function url(string $path): string
    {
        return rtrim(config('whatsapp.graph_url'), '/') . '/' . config('whatsapp.graph_version') . '/' . ltrim($path, '/');
    }

    private function handle(\Illuminate\Http\Client\Response $res): array
    {
        $json = $res->json() ?? [];
        if ($res->failed() || isset($json['error'])) {
            $e = $json['error'] ?? [];
            $detail = $e['error_data']['details'] ?? null;
            throw new WhatsAppApiException(
                trim(($e['message'] ?? 'WhatsApp request failed (HTTP ' . $res->status() . ')') . ($detail ? " — {$detail}" : '')),
                (int) ($e['code'] ?? 0),
                isset($e['error_subcode']) ? (int) $e['error_subcode'] : null,
            );
        }

        return $json;
    }
}
