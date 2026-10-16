<?php

namespace App\Http\Controllers\Agent;

use App\Http\Controllers\Agent\Concerns\ResolvesAgent;
use App\Http\Controllers\Controller;
use App\Models\CrmScheme;
use App\Models\WaCampaign;
use App\Models\WaMessage;
use App\Models\WaTemplate;
use App\Models\WhatsAppAccount;
use App\Services\WhatsApp\CloudApi;
use App\Services\WhatsApp\WhatsAppApiException;
use App\Services\WhatsApp\WhatsAppService;
use App\Support\Crm;
use App\Support\Phone;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

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
            $this->wa->refresh($account);
        } catch (WhatsAppApiException $e) {
            $account->forceFill(['status' => 'error', 'last_error' => $e->getMessage()])->save();

            return back()->with('error', 'Meta rejected those details: ' . $e->getMessage());
        }

        return back()->with('success', 'WhatsApp connected: ' . ($account->display_phone ?? 'number verified') . '. ' . $account->templates()->count() . ' templates synced.');
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
                'window'         => config('whatsapp.send_window'),
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

        $recipients = $this->wa->recipients($request->user(), $filters);
        if ($recipients->isEmpty()) {
            return back()->with('error', 'No owners with a valid mobile number match that audience.');
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

        $when = $this->wa->inSendWindow() && ! $campaign->scheduled_at?->isFuture()
            ? 'Sending has started.'
            : 'It will send between ' . implode(' and ', config('whatsapp.send_window')) . ' (SAST).';

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

        return Inertia::render('Agent/Crm/WhatsAppChat', [
            'agent'    => ['name' => $request->user()->name, 'agency_name' => $record->agency->name],
            'phone'    => $phone,
            'display'  => Phone::local($phone),
            'prospect' => $prospect ? ['id' => $prospect->id, 'owner' => $prospect->owner_name, 'unit' => $prospect->unit, 'scheme' => $prospect->scheme?->name, 'scheme_id' => $prospect->crm_scheme_id, 'opted_out' => (bool) $prospect->wa_opted_out_at] : null,
            'window_open_until' => $lastIn && $lastIn->sent_at?->gt(now()->subDay()) ? $lastIn->sent_at->addDay()->format('d M H:i') : null,
            'messages' => $messages->map(fn (WaMessage $m) => [
                'id'        => $m->id,
                'direction' => $m->direction,
                'body'      => $m->body,
                'status'    => $m->status,
                'campaign'  => $m->campaign?->name,
                'at'        => ($m->sent_at ?? $m->created_at)?->format('d M H:i'),
            ]),
        ]);
    }

    public function reply(Request $request): RedirectResponse
    {
        $account = $this->connected($request);
        $data = $request->validate(['phone' => ['required', 'string'], 'body' => ['required', 'string', 'max:4000']]);
        $phone = Phone::waZa($data['phone']) ?? abort(422);

        $lastIn = WaMessage::where('whatsapp_account_id', $account->id)->where('phone', $phone)->where('direction', 'in')->latest('sent_at')->first();
        if (! $lastIn || $lastIn->sent_at->lt(now()->subDay())) {
            return back()->with('error', 'WhatsApp only allows free replies within 24 hours of the owner’s last message. Use a template campaign instead.');
        }

        try {
            $wamid = $this->api->sendText($account, $phone, $data['body']);
        } catch (WhatsAppApiException $e) {
            return back()->with('error', 'Not sent: ' . $e->friendly());
        }

        WaMessage::create([
            'whatsapp_account_id' => $account->id,
            'agent_id'            => $account->agent_id,
            'crm_prospect_id'     => $lastIn->crm_prospect_id,
            'direction'           => 'out',
            'type'                => 'text',
            'phone'               => $phone,
            'body'                => $data['body'],
            'wamid'               => $wamid,
            'status'              => 'sent',
            'sent_at'             => now(),
        ]);

        return back();
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
        $r = $this->wa->recipients($request->user(), $filters);
        $first = $r->first();

        return [
            'count'        => $r->count(),
            'not_opted_in' => $r->filter(fn ($x) => ! $x['prospect']->wa_opt_in_at)->count(),
            'sample'       => $first ? [
                'owner'  => $first['prospect']->owner_name,
                'unit'   => $first['prospect']->unit,
                'scheme' => $first['prospect']->scheme?->name,
                'suburb' => $first['prospect']->scheme?->suburb?->name,
                'values' => $this->wa->values(
                    array_combine(array_keys(WhatsAppService::FIELDS), array_keys(WhatsAppService::FIELDS)),
                    $first['prospect'], $request->user(), $this->resolveAgentRecord($request)->agency->name,
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
