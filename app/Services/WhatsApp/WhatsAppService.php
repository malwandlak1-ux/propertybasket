<?php

namespace App\Services\WhatsApp;

use App\Models\CrmActivity;
use App\Models\CrmProspect;
use App\Models\User;
use App\Models\WaCampaign;
use App\Models\WaMessage;
use App\Models\WaTemplate;
use App\Models\WhatsAppAccount;
use App\Support\Crm;
use App\Support\Phone;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * CRM bulk WhatsApp: template sync, campaign creation and the throttled
 * dispatcher. Every safeguard against getting a number restricted lives
 * here — send window, Meta's daily limit, a per-number frequency cap,
 * opt-outs, de-duplication and auto-pause on account problems.
 */
class WhatsAppService
{
    /** Template variables an agent can map to CRM fields. */
    public const FIELDS = [
        'owner_name'  => 'Owner name',
        'suburb'      => 'Suburb',
        'scheme'      => 'Scheme / complex',
        'unit'        => 'Unit',
        'agent_name'  => 'Your name',
        'agent_phone' => 'Your phone',
        'agency_name' => 'Agency name',
    ];

    public function __construct(private CloudApi $api) {}

    // ── Account + templates ──────────────────────────────────────────────

    /**
     * First connect / re-connect: register the number for the Cloud API when
     * Meta reports it isn't yet (needs the agent's 6-digit PIN), subscribe the
     * app to the WABA so webhooks flow, then pull details + templates.
     */
    public function activate(WhatsAppAccount $account, ?string $pin = null): void
    {
        $info = $this->api->phoneNumber($account);
        $platform = $info['platform_type'] ?? 'CLOUD_API';
        if ($platform !== 'CLOUD_API') {
            if (! $pin) {
                throw new WhatsAppApiException('This number is added but not registered for the Cloud API yet (it shows "Pending" in WhatsApp Manager). Enter a 6-digit two-step PIN and connect again to register it.', 0);
            }
            $this->api->register($account, $pin);
        }

        try {
            $this->api->subscribeApp($account);
        } catch (\Throwable $e) {
            // Not fatal: sending still works; the webhook can be subscribed from the Meta dashboard.
            report($e);
        }

        $this->refresh($account);
    }

    /** Check the credentials with Meta and pull the number's details + templates. */
    public function refresh(WhatsAppAccount $account): void
    {
        $info = $this->api->phoneNumber($account);
        $account->fill([
            'display_phone'  => $info['display_phone_number'] ?? $account->display_phone,
            'verified_name'  => $info['verified_name'] ?? $account->verified_name,
            'quality_rating' => $info['quality_rating'] ?? $account->quality_rating,
            'status'         => 'connected',
            'last_error'     => null,
        ])->save();

        $this->syncTemplates($account);
    }

    public function syncTemplates(WhatsAppAccount $account): int
    {
        $seen = [];
        foreach ($this->api->templates($account) as $t) {
            $parsed = TemplateParser::parse($t['components'] ?? []);
            $row = WaTemplate::updateOrCreate(
                ['whatsapp_account_id' => $account->id, 'name' => $t['name'], 'language' => $t['language'] ?? 'en'],
                [
                    'meta_id'    => $t['id'] ?? null,
                    'category'   => $t['category'] ?? null,
                    'status'     => strtoupper($t['status'] ?? 'UNKNOWN'),
                    'components' => $t['components'] ?? [],
                ] + $parsed,
            );
            $seen[] = $row->id;
        }
        $account->templates()->whereNotIn('id', $seen)->delete();
        $account->forceFill(['last_synced_at' => now()])->save();

        return count($seen);
    }

    /** Create a body-only template (positional {{1}} variables) and submit it for review. */
    public function createTemplate(WhatsAppAccount $account, array $data): WaTemplate
    {
        $params = TemplateParser::placeholders($data['body']);
        $bodyComponent = ['type' => 'BODY', 'text' => $data['body']];
        if ($params) {
            $bodyComponent['example'] = ['body_text' => [array_map(fn ($p) => $data['examples'][$p] ?? "Example {$p}", $params)]];
        }
        $components = [$bodyComponent];
        if (! empty($data['footer'])) {
            $components[] = ['type' => 'FOOTER', 'text' => $data['footer']];
        }

        $res = $this->api->createTemplate($account, [
            'name'       => $data['name'],
            'language'   => $data['language'],
            'category'   => $data['category'],
            'components' => $components,
        ]);

        return WaTemplate::updateOrCreate(
            ['whatsapp_account_id' => $account->id, 'name' => $data['name'], 'language' => $data['language']],
            [
                'meta_id'    => $res['id'] ?? null,
                'category'   => $res['category'] ?? $data['category'],
                'status'     => strtoupper($res['status'] ?? 'PENDING'),
                'components' => $components,
            ] + TemplateParser::parse($components),
        );
    }

    // ── Campaigns ────────────────────────────────────────────────────────

    /**
     * Owners eligible for a campaign: the agent's own prospects with a valid
     * SA mobile number, not opted out, one message per number.
     *
     * @return Collection<int, array{prospect: CrmProspect, phone: string}>
     */
    /** Meta error codes meaning "this number can't receive WhatsApp" (not on WhatsApp / unsupported client). */
    public const UNDELIVERABLE = [131026];

    /**
     * Campaign recipients — one per OWNER, not per unit or per number:
     * - an owner with several units (same ID/reg number, else same name) gets one message;
     * - it goes to contact 1 of their first unit; contact 2 (then numbers on their other
     *   units) is only used if contact 1 turns out not to be on WhatsApp — see tryNextNumber();
     * - an owner who opted out on any unit is left out; a number already used for another
     *   owner (e.g. a spouse who co-owns) isn't messaged twice.
     * Each row: prospect (first unit), phone, units ("39, 51 and 72"), prospect_ids.
     */
    public function recipients(User $agent, array $filters): Collection
    {
        $q = CrmProspect::query()->where('agent_id', $agent->id)->with('scheme.suburb');
        if (! empty($filters['prospect_ids'])) {
            $q->whereIn('id', $filters['prospect_ids']);
        }
        if (! empty($filters['scheme_ids'])) {
            $q->whereIn('crm_scheme_id', $filters['scheme_ids']);
        }
        if (! empty($filters['statuses'])) {
            $q->whereIn('status', $filters['statuses']);
        }

        $seen = [];

        return $q->orderBy('id')->get()
            ->groupBy(fn (CrmProspect $p) => self::ownerKey($p))
            ->map(function (Collection $units) use (&$seen, $filters) {
                if ($units->contains(fn ($u) => $u->wa_opted_out_at)) {
                    return null;
                }
                if (! empty($filters['opted_in_only']) && ! $units->contains(fn ($u) => $u->wa_opt_in_at)) {
                    return null;
                }
                $phone = self::orderedPhones($units)[0] ?? null;
                if (! $phone || isset($seen[$phone])) {
                    return null;
                }
                $seen[$phone] = true;
                $first = $units->first();

                return [
                    'prospect'     => $first,
                    'phone'        => $phone,
                    'units'        => self::unitList($units),
                    'prospect_ids' => $units->pluck('id')->all(),
                ];
            })->filter()->values();
    }

    /** One key per real owner: ID / registration number when known, else the normalised name. */
    public static function ownerKey(CrmProspect $p): string
    {
        $id = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) $p->id_reg));

        return strlen($id) >= 6
            ? "id:{$id}"
            : 'name:' . strtoupper(preg_replace('/\s+/', ' ', trim((string) $p->owner_name)));
    }

    /** The owner's WhatsApp-able numbers in send order: contact 1, contact 2, then those on their other units. */
    public static function orderedPhones(Collection $units): array
    {
        $out = [];
        foreach ($units as $u) {
            foreach ([$u->phone1, $u->phone2] as $raw) {
                $wa = Phone::waZa((string) $raw);
                if ($wa && ! in_array($wa, $out, true)) {
                    $out[] = $wa;
                }
            }
        }

        return $out;
    }

    /** "39", "39 and 51", "39, 51 and 72". */
    public static function unitList(Collection $units): string
    {
        $list = $units->pluck('unit')->filter()->map(fn ($u) => trim((string) $u))->unique()
            ->sortBy(fn ($u) => ctype_digit($u) ? str_pad($u, 8, '0', STR_PAD_LEFT) : $u)->values()->all();
        if (count($list) <= 1) {
            return $list[0] ?? '';
        }
        $last = array_pop($list);

        return implode(', ', $list) . ' and ' . $last;
    }

    /**
     * Contact 1 couldn't receive WhatsApp: queue the same campaign message to the owner's
     * next number (contact 2, then numbers on their other units). Returns the new message,
     * or null when it isn't an "undeliverable" failure or there's no untried number left.
     */
    public function tryNextNumber(WaMessage $msg, ?string $errorCode): ?WaMessage
    {
        $p = $msg->prospect;
        if (! in_array((int) $errorCode, self::UNDELIVERABLE, true) || ! $msg->wa_campaign_id || ! $p || $p->wa_opted_out_at) {
            return null;
        }

        $key = self::ownerKey($p);
        $owner = CrmProspect::where('agent_id', $p->agent_id)
            ->where(fn ($q) => $q->where('owner_name', $p->owner_name)->when($p->id_reg, fn ($q) => $q->orWhere('id_reg', $p->id_reg)))
            ->orderBy('id')->get()
            ->filter(fn ($u) => self::ownerKey($u) === $key)
            ->sortBy(fn ($u) => $u->id === $p->id ? 0 : 1)->values();
        if ($owner->contains(fn ($u) => $u->wa_opted_out_at)) {
            return null;
        }

        $phones = self::orderedPhones($owner);
        $tried = WaMessage::where('wa_campaign_id', $msg->wa_campaign_id)->whereIn('phone', $phones)->pluck('phone')->all();
        $next = collect($phones)->first(fn ($ph) => ! in_array($ph, $tried, true));
        if (! $next) {
            return null;
        }

        return DB::transaction(function () use ($msg, $next) {
            $retry = WaMessage::create([
                'whatsapp_account_id' => $msg->whatsapp_account_id,
                'agent_id'            => $msg->agent_id,
                'wa_campaign_id'      => $msg->wa_campaign_id,
                'crm_prospect_id'     => $msg->crm_prospect_id,
                'direction'           => 'out',
                'type'                => 'template',
                'phone'               => $next,
                'body'                => $msg->body,
                'variables'           => $msg->variables,
                'status'              => 'queued',
            ]);
            $msg->update(['error_message' => mb_substr(rtrim((string) $msg->error_message) . ' — not on WhatsApp, trying ' . Phone::local($next), 0, 500)]);

            $campaign = $msg->campaign;
            $campaign->increment('total');
            if ($campaign->status === 'completed') {
                $campaign->update(['status' => 'sending', 'completed_at' => null]);
            }

            return $retry;
        });
    }

    /** Values for one recipient: template placeholder → text. */
    public function values(array $map, ?CrmProspect $p, User $agent, string $agencyName, ?string $units = null): array
    {
        $owner = $p ? self::displayName($p->owner_name) : '';
        $fields = [
            'owner_name'  => $owner,
            'suburb'      => $p?->scheme?->suburb?->name ?? '',
            'scheme'      => $p?->scheme?->name ?? '',
            'unit'        => $units ?: ($p?->unit ?? ''), // all of the owner's units when they have several
            'agent_name'  => $agent->name,
            'agent_phone' => (string) ($agent->phone ?? ''),
            'agency_name' => $agencyName,
        ];

        $out = [];
        foreach ($map as $param => $source) {
            $out[$param] = str_starts_with((string) $source, 'text:') ? substr($source, 5) : ($fields[$source] ?? '');
        }

        return $out;
    }

    /** Queue a campaign: one wa_messages row per recipient, rendered up front. */
    public function createCampaign(WhatsAppAccount $account, WaTemplate $template, User $agent, string $agencyName, array $data, Collection $recipients): WaCampaign
    {
        return DB::transaction(function () use ($account, $template, $agent, $agencyName, $data, $recipients) {
            $campaign = WaCampaign::create([
                'agency_id'           => $account->agency_id,
                'agent_id'            => $agent->id,
                'whatsapp_account_id' => $account->id,
                'wa_template_id'      => $template->id,
                'name'                => $data['name'],
                'template_name'       => $template->name,
                'template_language'   => $template->language,
                'variable_map'        => $data['variable_map'],
                'status'              => 'queued',
                'total'               => $recipients->count(),
                'scheduled_at'        => $data['scheduled_at'] ?? now(),
            ]);

            $now = now();
            $rows = $recipients->map(function ($r) use ($campaign, $account, $agent, $agencyName, $template, $data, $now) {
                $values = $this->values($data['variable_map'], $r['prospect'], $agent, $agencyName, $r['units'] ?? null);

                return [
                    'whatsapp_account_id' => $account->id,
                    'agent_id'            => $agent->id,
                    'wa_campaign_id'      => $campaign->id,
                    'crm_prospect_id'     => $r['prospect']->id,
                    'direction'           => 'out',
                    'type'                => 'template',
                    'phone'               => $r['phone'],
                    'body'                => TemplateParser::render((string) $template->body, $values),
                    'variables'           => json_encode($values),
                    'status'              => 'queued',
                    'created_at'          => $now,
                    'updated_at'          => $now,
                ];
            })->all();
            foreach (array_chunk($rows, 200) as $chunk) {
                WaMessage::insert($chunk);
            }

            return $campaign;
        });
    }

    // ── Dispatcher ───────────────────────────────────────────────────────

    /**
     * Send queued campaign messages. Called every minute by the scheduler and
     * after web requests; a cache lock stops two runs overlapping.
     */
    public function dispatch(?int $limit = null): int
    {
        $lock = Cache::lock('whatsapp:dispatch', 120);
        if (! $lock->get()) {
            return 0;
        }

        try {
            return $this->dispatchUnlocked($limit ?? (int) config('whatsapp.per_tick', 120));
        } finally {
            $lock->release();
        }
    }

    /** Whether campaign messages may go out right now (platform CPA schedule, narrowed by the number's own hours). */
    public function inSendWindow(?CarbonImmutable $at = null, ?WhatsAppAccount $account = null): bool
    {
        return SendSchedule::isOpen($account, $at);
    }

    private function dispatchUnlocked(int $limit): int
    {
        $campaigns = WaCampaign::whereIn('status', ['queued', 'sending'])
            ->where(fn ($q) => $q->whereNull('scheduled_at')->orWhere('scheduled_at', '<=', now()))
            ->with(['account', 'agent'])
            ->orderBy('id')
            ->get();

        if ($campaigns->isEmpty() || ! $this->inSendWindow()) {
            return 0;
        }

        $sent = 0;
        foreach ($campaigns as $campaign) {
            if ($sent >= $limit) {
                break;
            }
            if ($campaign->account && ! $this->inSendWindow(null, $campaign->account)) {
                continue; // outside this agent's own sending hours
            }
            $sent += $this->runCampaign($campaign, $limit - $sent);
        }

        return $sent;
    }

    private function runCampaign(WaCampaign $campaign, int $budget): int
    {
        $account = $campaign->account;
        if (! $account || $account->status !== 'connected') {
            $this->pause($campaign, 'Your WhatsApp number is disconnected. Reconnect it under CRM → WhatsApp.');

            return 0;
        }
        if (in_array(strtoupper((string) $account->quality_rating), ['RED', 'FLAGGED'], true)) {
            $this->pause($campaign, 'Meta rated this number’s quality as low. Sending is paused to protect the number.');

            return 0;
        }

        if ($campaign->status === 'queued') {
            $campaign->update(['status' => 'sending', 'started_at' => now()]);
        }

        // Meta caps how many people a number may start conversations with per 24h.
        $usedToday = WaMessage::where('whatsapp_account_id', $account->id)->where('direction', 'out')->where('type', 'template')
            ->where('sent_at', '>=', now()->subDay())->distinct()->count('phone');
        $room = min($budget, max(0, $account->dailyLimit() - $usedToday));
        if ($room === 0) {
            return 0; // resumes when the 24h window frees up
        }

        $days = (int) config('whatsapp.frequency_days', 30);
        $sent = 0;

        $batch = $campaign->messages()->where('status', 'queued')->with('prospect.scheme.suburb')->orderBy('id')->limit($room)->get();
        foreach ($batch as $msg) {
            $prospect = $msg->prospect;
            if ($prospect?->wa_opted_out_at) {
                $msg->update(['status' => 'skipped', 'error_message' => 'Owner opted out']);
                continue;
            }
            $recent = WaMessage::where('whatsapp_account_id', $account->id)->where('phone', $msg->phone)
                ->where('direction', 'out')->where('type', 'template')->where('id', '!=', $msg->id)
                ->where('sent_at', '>=', now()->subDays($days))->exists();
            if ($recent) {
                $msg->update(['status' => 'skipped', 'error_message' => "Already messaged in the last {$days} days"]);
                continue;
            }

            try {
                $wamid = $this->api->sendTemplate(
                    $account, $msg->phone, $campaign->template_name, $campaign->template_language,
                    TemplateParser::components($campaign->template?->params ?? array_keys($msg->variables ?? []), $msg->variables ?? []),
                );
            } catch (WhatsAppApiException $e) {
                if ($e->isTransient()) {
                    break; // try again next run
                }
                if ($e->pausesCampaign()) {
                    $account->update(['last_error' => $e->friendly()]);
                    $this->pause($campaign, $e->friendly());
                    break;
                }
                $msg->update(['status' => 'failed', 'failed_at' => now(), 'error_code' => (string) $e->metaCode, 'error_message' => mb_substr($e->getMessage(), 0, 500)]);
                $this->tryNextNumber($msg, (string) $e->metaCode); // contact 1 not on WhatsApp → contact 2
                continue;
            }

            $msg->update(['status' => 'sent', 'wamid' => $wamid, 'sent_at' => now()]);
            $this->logToCrm($msg, 'sent', "WhatsApp campaign: {$campaign->name}");
            $sent++;
        }

        // A retry to contact 2 may have just been queued in this run; it goes out next run.
        if (! $campaign->messages()->where('status', 'queued')->exists() && $campaign->fresh()->status === 'sending') {
            $campaign->update(['status' => 'completed', 'completed_at' => now()]);
        }

        return $sent;
    }

    public function pause(WaCampaign $campaign, string $reason): void
    {
        $campaign->update(['status' => 'paused', 'pause_reason' => $reason]);
    }

    /** Record a WhatsApp touch on the owner's CRM record (feeds the CRM stats). */
    public function logToCrm(WaMessage $msg, string $outcome, ?string $note = null): void
    {
        $p = $msg->prospect;
        if (! $p) {
            return;
        }
        CrmActivity::create([
            'agency_id'       => $p->agency_id,
            'agent_id'        => $p->agent_id,
            'crm_prospect_id' => $p->id,
            'channel'         => 'whatsapp',
            'outcome'         => $outcome,
            'quantity'        => 1,
            'note'            => $note ? mb_substr($note, 0, 500) : null,
            'occurred_on'     => now()->toDateString(),
        ]);
        $p->update(array_filter([
            'status'       => Crm::statusAfter($p->status, $outcome),
            'method'       => 'whatsapp',
            'contacted_on' => $p->contacted_on ? null : now()->toDateString(),
        ]));
    }

    /** Per-status counts for a set of campaigns: [campaign_id => [status => n]]. */
    public function stats(array $campaignIds): array
    {
        if (! $campaignIds) {
            return [];
        }
        $out = [];
        WaMessage::whereIn('wa_campaign_id', $campaignIds)
            ->groupBy('wa_campaign_id', 'status')
            ->selectRaw('wa_campaign_id, status, COUNT(*) AS n')
            ->get()
            ->each(function ($r) use (&$out) {
                $out[$r->wa_campaign_id][$r->status] = (int) $r->n;
            });
        WaMessage::whereIn('wa_campaign_id', $campaignIds)->whereNotNull('replied_at')
            ->groupBy('wa_campaign_id')->selectRaw('wa_campaign_id, COUNT(*) AS n')
            ->get()->each(function ($r) use (&$out) {
                $out[$r->wa_campaign_id]['replied'] = (int) $r->n;
            });

        return $out;
    }

    public static function displayName(?string $n): string
    {
        $n = trim((string) $n);
        if ($n === '') {
            return 'there';
        }
        if (preg_match('/\b(PTY|LTD|CC|TRUST|INV|PROP|HOLDINGS|BK|BELEGGINGS|INVESTMENTS?|GROUP)\b/i', $n)) {
            return $n;
        }

        return mb_convert_case(mb_strtolower($n), MB_CASE_TITLE);
    }
}
