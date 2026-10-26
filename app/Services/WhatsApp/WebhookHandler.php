<?php

namespace App\Services\WhatsApp;

use App\Models\CrmProspect;
use App\Models\WaCampaign;
use App\Models\WaMessage;
use App\Models\WaTemplate;
use App\Models\WhatsAppAccount;
use App\Notifications\WhatsAppMessageReceived;
use App\Support\Phone;
use Illuminate\Support\Carbon;

/**
 * Applies a Meta webhook delivery for one agent's number: message statuses,
 * owners' replies (incl. STOP / START), number quality and template reviews.
 */
class WebhookHandler
{
    private const STOP = ['stop', 'unsubscribe', 'opt out', 'optout', 'remove me', 'stop messages', 'no more'];
    private const START = ['start', 'subscribe', 'opt in', 'optin'];

    public function __construct(private WhatsAppService $wa) {}

    public static function validSignature(string $raw, ?string $header, ?string $secret): bool
    {
        if (! $secret || ! $header || ! str_starts_with($header, 'sha256=')) {
            return false;
        }

        return hash_equals('sha256=' . hash_hmac('sha256', $raw, $secret), $header);
    }

    public function handle(WhatsAppAccount $account, array $payload): void
    {
        foreach ($payload['entry'] ?? [] as $entry) {
            foreach ($entry['changes'] ?? [] as $change) {
                $value = $change['value'] ?? [];
                match ($change['field'] ?? '') {
                    'messages'                       => $this->messages($account, $value),
                    'phone_number_quality_update'    => $this->quality($account, $value),
                    'message_template_status_update' => $this->templateStatus($account, $value),
                    default                          => null,
                };
            }
        }
    }

    private function messages(WhatsAppAccount $account, array $value): void
    {
        // Ignore deliveries for a different number on the same app.
        $pnid = $value['metadata']['phone_number_id'] ?? null;
        if ($pnid && $pnid !== $account->phone_number_id) {
            return;
        }

        foreach ($value['statuses'] ?? [] as $s) {
            $this->status($account, $s);
        }
        foreach ($value['messages'] ?? [] as $m) {
            $this->inbound($account, $m);
        }
    }

    private function status(WhatsAppAccount $account, array $s): void
    {
        $msg = WaMessage::where('whatsapp_account_id', $account->id)->where('wamid', $s['id'] ?? '')->first();
        if (! $msg) {
            return;
        }
        $at = isset($s['timestamp']) ? Carbon::createFromTimestamp((int) $s['timestamp'], config('app.timezone')) : now();
        $status = $s['status'] ?? '';

        if ($status === 'failed') {
            $err = $s['errors'][0] ?? [];
            $msg->update([
                'status'        => 'failed',
                'failed_at'     => $at,
                'error_code'    => isset($err['code']) ? (string) $err['code'] : null,
                'error_message' => mb_substr(trim(($err['title'] ?? 'Failed') . ' ' . ($err['error_data']['details'] ?? '')), 0, 500),
            ]);

            return;
        }

        $rank = WaMessage::RANK[$status] ?? null;
        if ($rank === null || $msg->status === 'failed' || $rank <= (WaMessage::RANK[$msg->status] ?? -1)) {
            // Statuses arrive out of order; still stamp a missing time.
            if ($rank !== null && $status !== 'sent' && ! $msg->{"{$status}_at"}) {
                $msg->update(["{$status}_at" => $at]);
            }

            return;
        }

        $msg->update(array_filter([
            'status'       => $status,
            'sent_at'      => $msg->sent_at ?? $at,
            'delivered_at' => in_array($status, ['delivered', 'read'], true) ? ($msg->delivered_at ?? $at) : null,
            'read_at'      => $status === 'read' ? $at : null,
        ]));
    }

    private function inbound(WhatsAppAccount $account, array $m): void
    {
        if (WaMessage::where('whatsapp_account_id', $account->id)->where('wamid', $m['id'] ?? '')->exists()) {
            return; // Meta retries deliveries
        }

        $phone = Phone::waZa('+' . ltrim((string) ($m['from'] ?? ''), '+')) ?? (string) ($m['from'] ?? '');
        $text = trim((string) ($m['text']['body']
            ?? $m['button']['text']
            ?? $m['interactive']['button_reply']['title']
            ?? $m['interactive']['list_reply']['title']
            ?? '[' . ($m['type'] ?? 'message') . ']'));
        $prospects = $this->prospectsFor($account, $phone);

        $in = WaMessage::create([
            'whatsapp_account_id' => $account->id,
            'agent_id'            => $account->agent_id,
            'crm_prospect_id'     => $prospects->first()?->id,
            'direction'           => 'in',
            'type'                => $m['type'] ?? 'text',
            'phone'               => $phone,
            'body'                => mb_substr($text, 0, 4000),
            'wamid'               => $m['id'] ?? null,
            'status'              => 'received',
            'sent_at'             => isset($m['timestamp']) ? Carbon::createFromTimestamp((int) $m['timestamp'], config('app.timezone')) : now(),
        ]);

        $word = strtolower(trim($text, " \t\n.!"));
        $this->notifyAgent($account, $in, $prospects->first()?->owner_name, in_array($word, self::STOP, true));
        if (in_array($word, self::STOP, true)) {
            $prospects->each->update(['wa_opted_out_at' => now()]);
            $last = $this->lastOutbound($account, $phone);
            if ($last) {
                $this->wa->logToCrm($last, 'not_interested', 'Replied STOP on WhatsApp — opted out');
            }

            return;
        }
        if (in_array($word, self::START, true)) {
            $prospects->each->update(['wa_opted_out_at' => null, 'wa_opt_in_at' => now(), 'wa_opt_in_source' => 'whatsapp']);
        }

        // First reply to a campaign message counts as a conversation.
        $last = $this->lastOutbound($account, $phone);
        if ($last && ! $last->replied_at) {
            $last->update(['replied_at' => $in->sent_at]);
            $this->wa->logToCrm($last, 'connected', 'WhatsApp reply: ' . $text);
        }
    }

    /** Ring the agent's notification bell for every message an owner sends. */
    private function notifyAgent(WhatsAppAccount $account, WaMessage $in, ?string $ownerName, bool $optedOut): void
    {
        try {
            $account->agent?->notify(new WhatsAppMessageReceived($in, $ownerName, $optedOut));
        } catch (\Throwable $e) {
            report($e); // never let a notification failure lose the inbound message
        }
    }

    private function lastOutbound(WhatsAppAccount $account, string $phone): ?WaMessage
    {
        return WaMessage::where('whatsapp_account_id', $account->id)->where('phone', $phone)
            ->where('direction', 'out')->whereNotNull('sent_at')
            ->where('sent_at', '>=', now()->subDays(30))
            ->with('prospect')->latest('sent_at')->first();
    }

    /** The agent's CRM owners with this number (phones are stored as typed). */
    private function prospectsFor(WhatsAppAccount $account, string $phone)
    {
        // The last 4 digits survive however the number was typed ("082 111 2222").
        $tail = substr($phone, -4);

        return CrmProspect::where('agent_id', $account->agent_id)
            ->where(fn ($q) => $q->where('phone1', 'like', "%{$tail}%")->orWhere('phone2', 'like', "%{$tail}%"))
            ->get()
            ->filter(fn ($p) => Phone::waZa($p->phone1) === $phone || Phone::waZa($p->phone2) === $phone)
            ->values();
    }

    private function quality(WhatsAppAccount $account, array $v): void
    {
        $event = strtoupper((string) ($v['event'] ?? ''));
        $account->update(array_filter([
            'messaging_limit' => $v['current_limit'] ?? null,
            'quality_rating'  => match ($event) {
                'FLAGGED'   => 'RED',
                'UNFLAGGED' => 'GREEN',
                default     => null,
            },
        ]));

        if (in_array($event, ['FLAGGED', 'DOWNGRADE'], true)) {
            WaCampaign::where('whatsapp_account_id', $account->id)->whereIn('status', ['queued', 'sending'])
                ->get()->each(fn ($c) => $this->wa->pause($c, $event === 'FLAGGED'
                    ? 'Meta flagged this number for low quality. Sending is paused to protect it.'
                    : 'Meta lowered this number’s daily limit. Review the campaign before resuming.'));
        }
    }

    private function templateStatus(WhatsAppAccount $account, array $v): void
    {
        $t = WaTemplate::where('whatsapp_account_id', $account->id)
            ->where(fn ($q) => $q->where('meta_id', (string) ($v['message_template_id'] ?? ''))
                ->orWhere(fn ($q2) => $q2->where('name', $v['message_template_name'] ?? '')->where('language', $v['message_template_language'] ?? '')))
            ->first();
        $t?->update(['status' => strtoupper((string) ($v['event'] ?? $t->status))]);
    }
}
