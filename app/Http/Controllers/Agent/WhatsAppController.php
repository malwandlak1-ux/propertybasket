<?php

namespace App\Http\Controllers\Agent;

use App\Http\Controllers\Agent\Concerns\ResolvesAgent;
use App\Http\Controllers\Controller;
use App\Models\CrmProspect;
use App\Models\CrmScheme;
use App\Models\WaCampaign;
use App\Models\WaMessage;
use App\Models\WaTemplate;
use App\Models\WhatsAppAccount;
use App\Services\CrmService;
use App\Services\WhatsApp\CloudApi;
use App\Services\WhatsApp\SendSchedule;
use App\Services\WhatsApp\WhatsAppApiException;
use App\Services\WhatsApp\WhatsAppService;
use App\Support\Crm;
use App\Support\Phone;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * CRM → WhatsApp: the agent connects their own WhatsApp Business (Cloud API)
 * number, manages templates, sends bulk campaigns to CRM owners and answers
 * replies. Meta bills the agent's own WhatsApp account.
 */
class WhatsAppController extends Controller
{
    use ResolvesAgent;

    public function __construct(private WhatsAppService $wa, private CloudApi $api) {}

    public function index(Request $request): Response
    {
        $record = $this->resolveAgentRecord($request);
        $account = $this->account($request);

        $campaigns = $account
            ? WaCampaign::where('agent_id', $request->user()->id)->latest()->limit(50)->get()
            : collect();
        $stats = $this->wa->stats($campaigns->pluck('id')->all());

        return Inertia::render('Agent/Crm/WhatsApp', [
            'agent'     => ['name' => $request->user()->name, 'agency_name' => $record->agency->name],
            'account'   => $account ? $this->accountRow($account) : null,
            'stub'      => $this->api->isStub(),
            'templates' => $account ? $account->templates()->orderByRaw("CASE status WHEN 'APPROVED' THEN 0 ELSE 1 END")->orderBy('name')->get()
                ->map(fn (WaTemplate $t) => $this->templateRow($t)) : [],
            'campaigns' => $campaigns->map(fn (WaCampaign $c) => $this->campaignRow($c, $stats[$c->id] ?? [])),
            'threads'   => $account ? $this->threads($account) : [],
        ]);
    }

    // ── Connection ───────────────────────────────────────────────────────

    public function connect(Request $request): RedirectResponse
    {
        $record = $this->resolveAgentRecord($request);
        $existing = $this->account($request, withDisconnected: true);
        $data = $request->validate([
            'waba_id'         => ['required', 'regex:/^\d{5,25}$/'],
            'phone_number_id' => ['required', 'regex:/^\d{5,25}$/'],
            'access_token'    => [$existing && $existing->status !== 'disconnected' ? 'nullable' : 'required', 'string', 'min:20', 'max:2000'],
            'app_secret'      => ['nullable', 'string', 'min:16', 'max:200'],
            'pin'             => ['nullable', 'digits:6'],
        ], [
            'waba_id.regex'         => 'The WhatsApp Business Account ID is the long number from WhatsApp Manager.',
            'phone_number_id.regex' => 'The Phone number ID is the long number shown under API Setup (not the phone number itself).',
        ]);

        $account = $existing ?? new WhatsAppAccount(['agent_id' => $request->user()->id, 'agency_id' => $record->agency_id]);
        $account->fill([
            'waba_id'         => $data['waba_id'],
            'phone_number_id' => $data['phone_number_id'],
        ]);
        if (! empty($data['access_token'])) {
            $account->access_token = trim($data['access_token']);
        }
        if (! empty($data['app_secret'])) {
            $account->app_secret = trim($data['app_secret']);
        }
        $account->status = 'connected';

        try {
            $account->save();
            $this->wa->activate($account, $data['pin'] ?? null);
        } catch (WhatsAppApiException $e) {
            $account->forceFill(['status' => 'error', 'last_error' => $e->getMessage()])->save();

            return back()->with('error', 'Meta rejected those details: ' . $e->getMessage());
        }

        return back()->with('success', 'WhatsApp connected: ' . ($account->display_phone ?? 'number verified') . '. ' . $account->templates()->count() . ' templates synced.');
    }

    /** The agent's own sending hours — may only narrow the platform (CPA) schedule. */
    public function updateSchedule(Request $request): RedirectResponse
    {
        $account = $this->account($request);
        abort_unless($account, 422, 'Connect your WhatsApp Business number first.');
        $data = $request->validate([
            'send_from'      => ['nullable', 'date_format:H:i'],
            'send_until'     => ['nullable', 'date_format:H:i'],
            'send_saturdays' => ['required', 'boolean'],
        ]);
        if (! empty($data['send_from']) && ! empty($data['send_until']) && $data['send_from'] >= $data['send_until']) {
            throw ValidationException::withMessages(['send_until' => 'The end time must be after the start time.']);
        }
        $account->update([
            'send_from'      => $data['send_from'] ?: null,
            'send_until'     => $data['send_until'] ?: null,
            'send_saturdays' => (bool) $data['send_saturdays'],
        ]);

        return back()->with('success', 'Sending hours saved. Campaigns go out ' . SendSchedule::describe($account->fresh())['weekdays'] . ' on weekdays.');
    }

    public function disconnect(Request $request): RedirectResponse
    {
        $account = $this->account($request) ?? abort(404);
        $account->forceFill(['access_token' => '', 'app_secret' => null, 'status' => 'disconnected'])->save();
        WaCampaign::where('whatsapp_account_id', $account->id)->whereIn('status', ['queued', 'sending'])
            ->get()->each(fn ($c) => $this->wa->pause($c, 'WhatsApp was disconnected.'));

        return back()->with('success', 'WhatsApp disconnected. Your campaigns and message history are kept.');
    }

    // ── Templates ────────────────────────────────────────────────────────

    public function syncTemplates(Request $request): RedirectResponse
    {
        $account = $this->connected($request);
        try {
            $n = $this->wa->syncTemplates($account);
        } catch (WhatsAppApiException $e) {
            return back()->with('error', 'Could not sync templates: ' . $e->friendly());
        }

        return back()->with('success', "{$n} templates synced from WhatsApp.");
    }

    public function storeTemplate(Request $request): RedirectResponse
    {
        $account = $this->connected($request);
        $data = $request->validate([
            'name'       => ['required', 'regex:/^[a-z0-9_]{1,100}$/'],
            'category'   => ['required', Rule::in(['MARKETING', 'UTILITY'])],
            'language'   => ['required', Rule::in(['en', 'en_US', 'en_GB', 'af', 'zu', 'xh'])],
            'body'       => ['required', 'string', 'max:1024'],
            'footer'     => ['nullable', 'string', 'max:60'],
            'examples'   => ['nullable', 'array'],
            'examples.*' => ['nullable', 'string', 'max:100'],
        ], ['name.regex' => 'Use lowercase letters, numbers and underscores only, e.g. home_value_report.']);

        $params = \App\Services\WhatsApp\TemplateParser::placeholders($data['body']);
        foreach ($params as $i => $p) {
            if ((string) $p !== (string) ($i + 1)) {
                throw ValidationException::withMessages(['body' => 'Number the variables {{1}}, {{2}}, {{3}}… in order.']);
            }
        }

        try {
            $this->wa->createTemplate($account, $data);
        } catch (WhatsAppApiException $e) {
            return back()->with('error', 'Meta rejected the template: ' . $e->getMessage());
        }

        return back()->with('success', "Template {$data['name']} submitted to Meta for review. It can be used once it shows Approved.");
    }

    // ── Campaigns ────────────────────────────────────────────────────────

    public function createCampaign(Request $request): Response|RedirectResponse
    {
        $record = $this->resolveAgentRecord($request);
        $account = $this->account($request);
        if (! $account || $account->status !== 'connected') {
            return redirect()->route('agent.crm.whatsapp')->with('error', 'Connect your WhatsApp Business number first.');
        }
        $filters = $this->filters($request);
        $user = $request->user();

        $schemes = CrmScheme::where('agent_id', $user->id)->with('suburb:id,name')->withCount('prospects')->orderBy('name')->get()
            ->map(fn ($s) => ['id' => $s->id, 'name' => $s->name, 'suburb' => $s->suburb?->name, 'owners' => $s->prospects_count]);

        $usedToday = WaMessage::where('whatsapp_account_id', $account->id)->where('direction', 'out')->where('type', 'template')
            ->where('sent_at', '>=', now()->subDay())->distinct()->count('phone');

        return Inertia::render('Agent/Crm/WhatsAppCampaignNew', [
            'agent'     => ['name' => $user->name, 'agency_name' => $record->agency->name],
            'templates' => $account->templates()->where('status', 'APPROVED')->where('sendable', true)->orderBy('name')->get()
                ->map(fn (WaTemplate $t) => $this->templateRow($t)),
            'schemes'   => $schemes,
            'filters'   => $filters,
            'audience'  => $this->audience($request, $filters),
            'fields'    => WhatsAppService::FIELDS,
            'limits'    => [
                'daily'          => min($account->dailyLimit(), 1_000_000),
                'used_today'     => $usedToday,
                'frequency_days' => (int) config('whatsapp.frequency_days'),
                'schedule'       => SendSchedule::describe($account),
            ],
        ]);
    }

    public function storeCampaign(Request $request): RedirectResponse
    {
        $record = $this->resolveAgentRecord($request);
        $account = $this->connected($request);
        $filters = $this->filters($request);
        $data = $request->validate([
            'name'            => ['required', 'string', 'max:160'],
            'template_id'     => ['required', 'integer'],
            'variable_map'    => ['nullable', 'array'],
            'variable_map.*'  => ['nullable', 'string', 'max:300'],
            'scheduled_at'    => ['nullable', 'date', 'after_or_equal:now'],
            'confirm_consent' => ['nullable', 'boolean'],
            // Owners already messaged before whom the agent chose to message again.
            'include_contacted'   => ['nullable', 'array', 'max:5000'],
            'include_contacted.*' => ['string', 'max:300'],
        ]);

        $template = $account->templates()->where('status', 'APPROVED')->where('sendable', true)->findOrFail($data['template_id']);
        $map = [];
        foreach ($template->params ?? [] as $p) {
            $v = (string) ($data['variable_map'][$p] ?? '');
            if ($v === '' || (! array_key_exists($v, WhatsAppService::FIELDS) && ! (str_starts_with($v, 'text:') && strlen($v) > 5))) {
                throw ValidationException::withMessages(['variable_map' => "Choose what fills {{{$p}}}."]);
            }
            $map[$p] = $v;
        }

        $recipients = $this->wa->recipients($request->user(), $filters, $data['include_contacted'] ?? []);
        if ($recipients->isEmpty()) {
            return back()->with('error', 'No owners to message: everyone in that audience has opted out, was already contacted (and not added back), or has no valid mobile number.');
        }
        $notOptedIn = $recipients->filter(fn ($r) => ! $r['prospect']->wa_opt_in_at)->count();
        if ($notOptedIn > 0 && empty($data['confirm_consent'])) {
            throw ValidationException::withMessages(['confirm_consent' => "Confirm you may message the {$notOptedIn} owners who haven’t opted in."]);
        }

        $campaign = $this->wa->createCampaign($account, $template, $request->user(), $record->agency->name, [
            'name'         => $data['name'],
            'variable_map' => $map,
            'scheduled_at' => $data['scheduled_at'] ?? null,
        ], $recipients);

        // Start straight away (inside the send window) rather than waiting for the next cron run.
        if ((int) config('whatsapp.per_request_tick', 40) > 0) {
            app()->terminating(function () {
                try {
                    app(WhatsAppService::class)->dispatch((int) config('whatsapp.per_request_tick', 40));
                } catch (\Throwable $e) {
                    report($e);
                }
            });
        }

        $start = $campaign->scheduled_at?->isFuture() ? CarbonImmutable::parse($campaign->scheduled_at) : CarbonImmutable::now();
        $next = SendSchedule::nextOpen($account, $start);
        $when = $next && $next->lessThanOrEqualTo(CarbonImmutable::now())
            ? 'Sending has started.'
            : 'It will start sending ' . SendSchedule::label($next) . ' (your sending hours).';

        return redirect()->route('agent.crm.whatsapp.campaigns.show', $campaign)
            ->with('success', "Campaign queued for {$recipients->count()} owners. {$when}");
    }

    public function showCampaign(Request $request, WaCampaign $campaign): Response
    {
        $record = $this->resolveAgentRecord($request);
        $this->own($request, $campaign->agent_id);

        $messages = $campaign->messages()->with('prospect:id,owner_name,unit,crm_scheme_id')
            ->orderByRaw("CASE status WHEN 'failed' THEN 0 WHEN 'queued' THEN 2 ELSE 1 END")->orderBy('id')
            ->paginate(50)->withQueryString();

        return Inertia::render('Agent/Crm/WhatsAppCampaign', [
            'agent'    => ['name' => $request->user()->name, 'agency_name' => $record->agency->name],
            'campaign' => $this->campaignRow($campaign, $this->wa->stats([$campaign->id])[$campaign->id] ?? []) + [
                'sample' => $campaign->messages()->value('body'),
            ],
            'messages' => $messages->through(fn (WaMessage $m) => [
                'id'        => $m->id,
                'owner'     => $m->prospect?->owner_name,
                'unit'      => $m->prospect?->unit,
                'scheme_id' => $m->prospect?->crm_scheme_id,
                'phone'     => Phone::local($m->phone),
                'status'    => $m->status,
                'error'     => $m->error_message,
                'sent_at'   => $m->sent_at?->format('d M H:i'),
                'read_at'   => $m->read_at?->format('d M H:i'),
                'replied'   => (bool) $m->replied_at,
            ]),
        ]);
    }

    public function pauseCampaign(Request $request, WaCampaign $campaign): RedirectResponse
    {
        $this->own($request, $campaign->agent_id);
        abort_unless(in_array($campaign->status, ['queued', 'sending'], true), 422);
        $this->wa->pause($campaign, 'Paused by you.');

        return back()->with('success', 'Campaign paused.');
    }

    public function resumeCampaign(Request $request, WaCampaign $campaign): RedirectResponse
    {
        $this->own($request, $campaign->agent_id);
        abort_unless($campaign->status === 'paused', 422);
        $account = $this->connected($request);
        if (in_array(strtoupper((string) $account->quality_rating), ['RED', 'FLAGGED'], true)) {
            return back()->with('error', 'Meta still rates this number’s quality as low. Wait for it to recover before resuming.');
        }
        $campaign->update(['status' => 'sending', 'pause_reason' => null]);

        return back()->with('success', 'Campaign resumed.');
    }

    public function cancelCampaign(Request $request, WaCampaign $campaign): RedirectResponse
    {
        $this->own($request, $campaign->agent_id);
        abort_if(in_array($campaign->status, ['completed', 'cancelled'], true), 422);
        $campaign->messages()->where('status', 'queued')->update(['status' => 'skipped', 'error_message' => 'Campaign cancelled']);
        $campaign->update(['status' => 'cancelled', 'completed_at' => now()]);

        return back()->with('success', 'Campaign cancelled. Messages already sent are unaffected.');
    }

    // ── Inbox ────────────────────────────────────────────────────────────

    public function chat(Request $request): Response
    {
        $record = $this->resolveAgentRecord($request);
        $account = $this->account($request) ?? abort(404);
        $phone = Phone::waZa((string) $request->query('phone')) ?? abort(404);

        $messages = WaMessage::where('whatsapp_account_id', $account->id)->where('phone', $phone)
            ->with('campaign:id,name')->latest('id')->limit(200)->get()->reverse()->values();
        $lastIn = $messages->where('direction', 'in')->last();
        $prospect = $messages->firstWhere('crm_prospect_id', '!=', null)?->prospect()->with('scheme:id,name')->first();
        if (! $prospect) {
            // Not linked to a message yet: match the number against the agent's CRM owners.
            $tail = substr($phone, -4);
            $prospect = CrmProspect::where('agent_id', $request->user()->id)
                ->where(fn ($q) => $q->where('phone1', 'like', "%{$tail}%")->orWhere('phone2', 'like', "%{$tail}%"))
                ->with('scheme:id,name')->get()
                ->first(fn ($p) => Phone::waZa((string) $p->phone1) === $phone || Phone::waZa((string) $p->phone2) === $phone);
        }
        $user = $request->user();

        return Inertia::render('Agent/Crm/WhatsAppChat', [
            'agent'    => ['name' => $request->user()->name, 'agency_name' => $record->agency->name],
            'phone'    => $phone,
            'display'  => Phone::local($phone),
            'prospect' => $prospect ? ['id' => $prospect->id, 'owner' => $prospect->owner_name, 'unit' => $prospect->unit, 'scheme' => $prospect->scheme?->name, 'scheme_id' => $prospect->crm_scheme_id, 'opted_out' => (bool) $prospect->wa_opted_out_at] : null,
            // The owner's farming record, shown as a side panel (log a contact, pipeline, details).
            'panel'    => $prospect ? app(CrmService::class)->prospectPanel($prospect) : null,
            'profile'  => ['name' => $user->name, 'agency' => $record->agency->name, 'phone' => $user->phone],
            'window_open_until' => $lastIn && $lastIn->sent_at?->gt(now()->subDay()) ? $lastIn->sent_at->addDay()->format('d M H:i') : null,
            'messages' => $messages->map(fn (WaMessage $m) => [
                'id'        => $m->id,
                'direction' => $m->direction,
                'body'      => $m->body,
                'media'     => $m->media_path ? [
                    'url'  => route('agent.crm.whatsapp.media', $m),
                    'name' => $m->media_name,
                    'kind' => $m->type,
                ] : null,
                'status'    => $m->status,
                'campaign'  => $m->campaign?->name,
                'at'        => ($m->sent_at ?? $m->created_at)?->format('d M H:i'),
            ]),
        ]);
    }

    /** Attachment types WhatsApp accepts on a reply, by our upload extension. */
    private const ATTACH_EXT = 'jpg,jpeg,png,mp4,3gp,mp3,ogg,aac,m4a,amr,pdf,doc,docx,xls,xlsx,ppt,pptx,txt,csv';

    public function reply(Request $request): RedirectResponse
    {
        $account = $this->connected($request);
        $data = $request->validate([
            'phone'      => ['required', 'string'],
            'body'       => ['nullable', 'required_without:attachment', 'string', 'max:4000'],
            'attachment' => ['nullable', 'file', 'max:16384', 'mimes:' . self::ATTACH_EXT],
        ], [
            'body.required_without' => 'Type a message or attach a file.',
            'attachment.max'        => 'Attachments can be up to 16 MB.',
            'attachment.mimes'      => 'WhatsApp accepts photos (JPG/PNG), videos (MP4), voice notes/audio and documents (PDF, Word, Excel, PowerPoint, TXT, CSV).',
        ]);
        $phone = Phone::waZa($data['phone']) ?? abort(422);
        $body = trim((string) ($data['body'] ?? ''));

        $lastIn = WaMessage::where('whatsapp_account_id', $account->id)->where('phone', $phone)->where('direction', 'in')->latest('sent_at')->first();
        if (! $lastIn || $lastIn->sent_at->lt(now()->subDay())) {
            return back()->with('error', 'WhatsApp only allows free replies within 24 hours of the owner’s last message. Use a template campaign instead.');
        }

        $base = [
            'whatsapp_account_id' => $account->id,
            'agent_id'            => $account->agent_id,
            'crm_prospect_id'     => $lastIn->crm_prospect_id,
            'direction'           => 'out',
            'phone'               => $phone,
            'status'              => 'sent',
            'sent_at'             => now(),
        ];

        $file = $request->file('attachment');
        if (! $file) {
            try {
                $wamid = $this->api->sendText($account, $phone, $body);
            } catch (WhatsAppApiException $e) {
                return back()->with('error', 'Not sent: ' . $e->friendly());
            }
            WaMessage::create($base + ['type' => 'text', 'body' => $body, 'wamid' => $wamid]);

            return back();
        }

        $mime = $file->getMimeType() ?: 'application/octet-stream';
        $name = mb_substr(preg_replace('/[^\w.\- ()]+/u', '_', $file->getClientOriginalName()) ?: 'attachment', 0, 200);
        $kind = $this->mediaKind($mime, $file->getSize());
        $path = $file->store("wa-media/{$account->id}", 'local');

        try {
            $mediaId = $this->api->uploadMedia($account, Storage::disk('local')->path($path), $mime, $name);
            $wamid = $this->api->sendMedia($account, $phone, $kind, $mediaId, $body ?: null, $name);
            // Audio can't carry a caption — send the text straight after it.
            $textWamid = ($kind === 'audio' && $body !== '') ? $this->api->sendText($account, $phone, $body) : null;
        } catch (WhatsAppApiException $e) {
            Storage::disk('local')->delete($path);

            return back()->with('error', 'Not sent: ' . $e->friendly());
        }

        WaMessage::create($base + [
            'type' => $kind, 'body' => $kind === 'audio' ? null : ($body ?: null), 'wamid' => $wamid,
            'media_path' => $path, 'media_name' => $name, 'media_mime' => $mime,
        ]);
        if ($textWamid) {
            WaMessage::create($base + ['type' => 'text', 'body' => $body, 'wamid' => $textWamid]);
        }

        return back();
    }

    /** GET /agent/crm/whatsapp/media/{message} — the agent's own copy of an attachment they sent. */
    public function media(Request $request, WaMessage $message): StreamedResponse
    {
        abort_unless((int) $message->agent_id === (int) $request->user()->id, 403);
        abort_unless($message->media_path && Storage::disk('local')->exists($message->media_path), 404);

        return Storage::disk('local')->response($message->media_path, $message->media_name, [
            'Content-Type'  => $message->media_mime ?: 'application/octet-stream',
            'Cache-Control' => 'private, max-age=86400',
        ], $request->boolean('download') ? 'attachment' : 'inline');
    }

    /** WhatsApp message type for a file: images over 5 MB (or not JPG/PNG) go as documents. */
    private function mediaKind(string $mime, ?int $bytes): string
    {
        return match (true) {
            in_array($mime, ['image/jpeg', 'image/png'], true) && ($bytes ?? 0) <= 5 * 1024 * 1024 => 'image',
            in_array($mime, ['video/mp4', 'video/3gpp'], true) => 'video',
            str_starts_with($mime, 'audio/') => 'audio',
            default => 'document',
        };
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private function account(Request $request, bool $withDisconnected = false): ?WhatsAppAccount
    {
        $a = WhatsAppAccount::where('agent_id', $request->user()->id)->first();

        return $a && ($withDisconnected || $a->status !== 'disconnected') ? $a : null;
    }

    private function connected(Request $request): WhatsAppAccount
    {
        $a = $this->account($request);
        abort_unless($a && $a->status === 'connected', 422, 'Connect your WhatsApp Business number first.');

        return $a;
    }

    private function own(Request $request, int $agentId): void
    {
        abort_unless((int) $agentId === (int) $request->user()->id, 403, 'This campaign belongs to another agent.');
    }

    private function filters(Request $request): array
    {
        $f = $request->validate([
            'scheme_ids'    => ['nullable', 'array'], 'scheme_ids.*' => ['integer'],
            'statuses'      => ['nullable', 'array'], 'statuses.*' => [Rule::in(array_keys(Crm::STATUSES))],
            'prospect_ids'  => ['nullable', 'array'], 'prospect_ids.*' => ['integer'],
            'opted_in_only' => ['nullable', 'boolean'],
            'scheme'        => ['nullable', 'integer'],
        ]);
        if (! empty($f['scheme']) && empty($f['scheme_ids'])) {
            $f['scheme_ids'] = [(int) $f['scheme']];
        }
        unset($f['scheme']);

        return [
            'scheme_ids'    => array_map('intval', $f['scheme_ids'] ?? []),
            'statuses'      => $f['statuses'] ?? [],
            'prospect_ids'  => array_map('intval', $f['prospect_ids'] ?? []),
            'opted_in_only' => (bool) ($f['opted_in_only'] ?? false),
        ];
    }

    private function audience(Request $request, array $filters): array
    {
        $report = $this->wa->audienceReport($request->user(), $filters);
        $r = $report['recipients'];
        $first = $r->first();

        return [
            // Opted out (here or on another scheme) — always left out, shown so the agent knows.
            'opted_out'    => $report['opted_out'],
            // Already received a campaign message — left out unless the agent ticks "send again".
            'contacted'    => $report['contacted'],
            'count'        => $r->count(),
            'not_opted_in' => $r->filter(fn ($x) => ! $x['prospect']->wa_opt_in_at)->count(),
            'sample'       => $first ? [
                'owner'  => $first['prospect']->owner_name,
                'unit'   => $first['units'] ?: $first['prospect']->unit,
                'scheme' => $first['prospect']->scheme?->name,
                'suburb' => $first['prospect']->scheme?->suburb?->name,
                'values' => $this->wa->values(
                    array_combine(array_keys(WhatsAppService::FIELDS), array_keys(WhatsAppService::FIELDS)),
                    $first['prospect'], $request->user(), $this->resolveAgentRecord($request)->agency->name, $first['units'],
                ),
            ] : null,
        ];
    }

    private function accountRow(WhatsAppAccount $a): array
    {
        return [
            'waba_id'         => $a->waba_id,
            'phone_number_id' => $a->phone_number_id,
            'display_phone'   => $a->display_phone,
            'verified_name'   => $a->verified_name,
            'quality_rating'  => $a->quality_rating,
            'messaging_limit' => $a->messaging_limit,
            'daily_limit'     => min($a->dailyLimit(), 1_000_000),
            'status'          => $a->status,
            'last_error'      => $a->last_error,
            'last_synced_at'  => $a->last_synced_at?->diffForHumans(),
            'token_hint'      => $a->access_token ? '••••' . substr($a->access_token, -4) : null,
            'has_app_secret'  => (bool) $a->app_secret,
            'webhook_url'     => url("/webhooks/whatsapp/{$a->webhook_key}"),
            'verify_token'    => $a->verify_token,
            'send_from'       => $a->send_from,
            'send_until'      => $a->send_until,
            'send_saturdays'  => $a->send_saturdays !== false,
            'schedule'        => SendSchedule::describe($a),
        ];
    }

    private function templateRow(WaTemplate $t): array
    {
        return [
            'id'       => $t->id,
            'name'     => $t->name,
            'language' => $t->language,
            'category' => $t->category,
            'status'   => $t->status,
            'body'     => $t->body,
            'footer'   => $t->footer,
            'params'   => $t->params ?? [],
            'sendable' => $t->sendable,
            'reason'   => $t->unsupported_reason,
        ];
    }

    private function campaignRow(WaCampaign $c, array $s): array
    {
        $sent = ($s['sent'] ?? 0) + ($s['delivered'] ?? 0) + ($s['read'] ?? 0);

        return [
            'id'           => $c->id,
            'name'         => $c->name,
            'template'     => $c->template_name,
            'status'       => $c->status,
            'pause_reason' => $c->pause_reason,
            'total'        => $c->total,
            'queued'       => $s['queued'] ?? 0,
            'sent'         => $sent,
            'delivered'    => ($s['delivered'] ?? 0) + ($s['read'] ?? 0),
            'read'         => $s['read'] ?? 0,
            'replied'      => $s['replied'] ?? 0,
            'failed'       => $s['failed'] ?? 0,
            'skipped'      => $s['skipped'] ?? 0,
            'created_at'   => $c->created_at?->format('d M Y H:i'),
            'scheduled_at' => $c->scheduled_at?->isFuture() ? $c->scheduled_at->format('d M Y H:i') : null,
        ];
    }

    /** Latest conversation per number (owners who replied). */
    private function threads(WhatsAppAccount $account): array
    {
        $latest = WaMessage::where('whatsapp_account_id', $account->id)->where('direction', 'in')
            ->selectRaw('phone, MAX(id) AS last_id, COUNT(*) AS n')->groupBy('phone')
            ->orderByDesc('last_id')->limit(30)->get();
        $msgs = WaMessage::whereIn('id', $latest->pluck('last_id'))->with('prospect:id,owner_name')->get()->keyBy('id');

        return $latest->map(function ($row) use ($msgs) {
            $m = $msgs->get($row->last_id);

            return [
                'phone'   => $row->phone,
                'display' => Phone::local($row->phone),
                'owner'   => $m?->prospect?->owner_name,
                'last'    => $m?->body,
                'at'      => $m?->sent_at?->diffForHumans(),
                'open'    => (bool) $m?->sent_at?->gt(now()->subDay()),
            ];
        })->all();
    }
}
