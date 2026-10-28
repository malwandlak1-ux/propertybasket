<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\CrmActivity;
use App\Models\CrmProspect;
use App\Models\CrmScheme;
use App\Models\CrmSuburb;
use App\Models\User;
use App\Models\WaCampaign;
use App\Models\WaMessage;
use App\Models\WaTemplate;
use App\Models\WhatsAppAccount;
use App\Services\WhatsApp\SendSchedule;
use App\Services\WhatsApp\WhatsAppService;
use Carbon\CarbonImmutable;
use Carbon\Carbon;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** CRM bulk WhatsApp over Meta's Cloud API (Http::fake stands in for Meta). */
class WhatsAppTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $agent;
    private User $other;
    private Agency $agency;
    private CrmScheme $scheme;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        // Tests drive the dispatcher themselves (no send-after-response).
        config(['whatsapp.stub' => false, 'whatsapp.graph_version' => 'v23.0', 'whatsapp.per_request_tick' => 0]);
        // Inside the 08:00–19:00 SAST send window.
        Carbon::setTestNow(Carbon::parse('2026-10-20 10:00', 'Africa/Johannesburg'));

        $this->owner = User::factory()->create(['role' => Role::AgencyAdmin, 'status' => UserStatus::Active]);
        $this->owner->assignRole('agency_admin');
        $this->agency = Agency::create(['user_id' => $this->owner->id, 'name' => 'Sandton Realty', 'slug' => 'sr-' . Str::random(6), 'email' => $this->owner->email, 'status' => 'active']);
        $this->agency->activateSubscription('promo', now()->addYear());
        $this->agent = $this->makeAgent('Sipho Dlamini');
        $this->other = $this->makeAgent('Aisha Patel');

        $suburb = CrmSuburb::where('name', 'Sunnyside')->firstOrFail();
        $this->scheme = CrmScheme::create(['crm_suburb_id' => $suburb->id, 'agency_id' => $this->agency->id, 'agent_id' => $this->agent->id, 'name' => 'SS Maxbie']);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function makeAgent(string $name): User
    {
        $u = User::factory()->create(['role' => Role::Agent, 'status' => UserStatus::Active, 'name' => $name, 'phone' => '0825550000']);
        $u->assignRole('agent');
        AgencyAgent::create(['agency_id' => $this->agency->id, 'user_id' => $u->id, 'commission_split_percent' => 50, 'lead_allocation_position' => 0, 'ffc_number' => 'FFC-' . $u->id, 'ffc_expires_at' => now()->addYear(), 'status' => 'active']);

        return $u;
    }

    private function prospect(array $attrs = []): CrmProspect
    {
        return $this->scheme->prospects()->create($attrs + [
            'agency_id' => $this->agency->id, 'agent_id' => $this->agent->id,
            'owner_name' => 'NKOSI THABO', 'unit' => '1', 'phone1' => '082 111 2222', 'status' => 'not_contacted',
        ]);
    }

    private function account(array $attrs = []): WhatsAppAccount
    {
        return WhatsAppAccount::create($attrs + [
            'agent_id' => $this->agent->id, 'agency_id' => $this->agency->id, 'waba_id' => '1111111111', 'phone_number_id' => '2222222222',
            'access_token' => 'EAAG-test-token-1234567890', 'app_secret' => 'app-secret-abcdef123456', 'status' => 'connected', 'quality_rating' => 'GREEN',
        ]);
    }

    private function template(WhatsAppAccount $a): WaTemplate
    {
        return WaTemplate::create([
            'whatsapp_account_id' => $a->id, 'name' => 'home_value_report', 'language' => 'en', 'category' => 'MARKETING', 'status' => 'APPROVED',
            'body' => 'Hi {{1}}, I am {{2}} focused on {{3}}.', 'params' => ['1', '2', '3'], 'sendable' => true, 'components' => [],
        ]);
    }

    private function fakeMeta(mixed $send = null): void
    {
        Http::fake([
            'graph.facebook.com/v23.0/2222222222/messages' => $send ?? Http::response(['messages' => [['id' => 'wamid.' . Str::random(12)]]]),
            'graph.facebook.com/v23.0/1111111111/subscribed_apps' => Http::response(['success' => true]),
            'graph.facebook.com/v23.0/2222222222*' => Http::response(['display_phone_number' => '+27 82 555 0000', 'verified_name' => 'Sipho Dlamini', 'quality_rating' => 'GREEN']),
            'graph.facebook.com/v23.0/1111111111/message_templates*' => Http::response(['data' => [
                ['id' => '9', 'name' => 'home_value_report', 'language' => 'en', 'status' => 'APPROVED', 'category' => 'MARKETING', 'components' => [['type' => 'BODY', 'text' => 'Hi {{1}}, I am {{2}} focused on {{3}}.']]],
                ['id' => '10', 'name' => 'listing_photo', 'language' => 'en', 'status' => 'APPROVED', 'category' => 'MARKETING', 'components' => [['type' => 'HEADER', 'format' => 'IMAGE'], ['type' => 'BODY', 'text' => 'New listing']]],
            ]]),
        ]);
    }

    private function campaign(array $post = []): void
    {
        $a = WhatsAppAccount::firstOrFail();
        $t = $a->templates()->where('name', 'home_value_report')->first() ?? $this->template($a);
        $this->actingAs($this->agent)->post('/agent/crm/whatsapp/campaigns', $post + [
            'name' => 'Maxbie value reports', 'template_id' => $t->id,
            'variable_map' => ['1' => 'owner_name', '2' => 'agent_name', '3' => 'suburb'],
            'scheme_ids' => [$this->scheme->id], 'confirm_consent' => true,
        ])->assertRedirect();
    }

    #[Test]
    public function an_agent_connects_their_own_number_and_templates_sync(): void
    {
        $this->fakeMeta();
        $this->actingAs($this->agent)->post('/agent/crm/whatsapp/account', [
            'waba_id' => '1111111111', 'phone_number_id' => '2222222222', 'access_token' => 'EAAG-test-token-1234567890', 'app_secret' => 'app-secret-abcdef123456',
        ])->assertSessionHas('success');

        $a = WhatsAppAccount::where('agent_id', $this->agent->id)->firstOrFail();
        $this->assertSame('+27 82 555 0000', $a->display_phone);
        $this->assertNotSame('EAAG-test-token-1234567890', \DB::table('whatsapp_accounts')->value('access_token'), 'Token is encrypted at rest');
        $this->assertTrue($a->templates()->where('name', 'home_value_report')->value('sendable'));
        $this->assertFalse((bool) $a->templates()->where('name', 'listing_photo')->value('sendable'));

        $this->actingAs($this->agent)->get('/agent/crm/whatsapp')->assertOk()
            ->assertInertia(fn (Assert $p) => $p->component('Agent/Crm/WhatsApp')
                ->where('account.display_phone', '+27 82 555 0000')
                ->missing('account.access_token')
                ->where('account.token_hint', '••••7890'));
    }

    #[Test]
    public function a_pending_number_is_registered_with_the_pin_and_the_app_subscribed(): void
    {
        Http::fake([
            'graph.facebook.com/v23.0/2222222222/register' => Http::response(['success' => true]),
            'graph.facebook.com/v23.0/1111111111/subscribed_apps' => Http::response(['success' => true]),
            'graph.facebook.com/v23.0/2222222222*' => Http::response(['display_phone_number' => '+27 74 832 9393', 'verified_name' => 'Property Basket', 'platform_type' => 'NOT_APPLICABLE']),
            'graph.facebook.com/v23.0/1111111111/message_templates*' => Http::response(['data' => []]),
        ]);
        $creds = ['waba_id' => '1111111111', 'phone_number_id' => '2222222222', 'access_token' => 'EAAG-test-token-1234567890'];

        // Without a PIN the agent is told the number still needs registering.
        $this->actingAs($this->agent)->post('/agent/crm/whatsapp/account', $creds)->assertSessionHas('error');
        Http::assertNotSent(fn ($r) => str_ends_with($r->url(), '/register'));

        $this->actingAs($this->agent)->post('/agent/crm/whatsapp/account', $creds + ['pin' => '123456'])->assertSessionHas('success');
        Http::assertSent(fn ($r) => str_ends_with($r->url(), '2222222222/register') && $r['pin'] === '123456' && $r['messaging_product'] === 'whatsapp');
        Http::assertSent(fn ($r) => str_ends_with($r->url(), '1111111111/subscribed_apps'));
        $this->assertSame('connected', WhatsAppAccount::firstOrFail()->status);
    }

    #[Test]
    public function one_message_per_owner_to_contact_1_then_contact_2_if_not_on_whatsapp(): void
    {
        $this->fakeMeta();
        $a = $this->account();
        // MOLEFE owns units 1 and 7 (same ID); contact 1 differs per unit, unit 1 also has contact 2.
        $this->prospect(['owner_name' => 'MOLEFE SIPHO', 'unit' => '7', 'id_reg' => '8001015800081', 'phone1' => '0831110001']);
        $this->prospect(['owner_name' => 'MOLEFE SIPHO', 'unit' => '1', 'id_reg' => '8001015800081', 'phone1' => '0831110002', 'phone2' => '0831110003']);
        // Owner with two units but no ID: matched by name.
        $this->prospect(['owner_name' => 'MEGA PROP PTY LTD', 'unit' => '27', 'phone1' => '0721110001']);
        $this->prospect(['owner_name' => 'Mega  Prop Pty Ltd', 'unit' => '28', 'phone1' => '0721110001']);
        // Contact 1 works for this owner; contact 2 must never be used.
        $this->prospect(['owner_name' => 'DLAMINI ZODWA', 'unit' => '3', 'id_reg' => '9002020800082', 'phone1' => '0611110001', 'phone2' => '0611110002']);

        $this->campaign();
        $campaign = WaCampaign::firstOrFail();
        $this->assertSame(3, $campaign->total, 'Three owners, not five units');
        $molefe = WaMessage::where('wa_campaign_id', $campaign->id)->where('phone', '27831110001')->firstOrFail();
        $this->assertSame(0, WaMessage::whereIn('phone', ['27831110002', '27831110003'])->count(), 'Only contact 1 of the first unit is queued');
        $this->assertSame(1, WaMessage::where('phone', '27721110001')->count());

        // The template's unit field lists all the owner's units.
        $vals = app(WhatsAppService::class)->values(['1' => 'unit'], $molefe->prospect, $this->agent, 'Sandton Realty', '1 and 7');
        $this->assertSame('1 and 7', $vals['1']);
        $this->assertSame('1 and 7', app(WhatsAppService::class)->recipients($this->agent, ['scheme_ids' => [$this->scheme->id]])
            ->firstWhere('phone', '27831110001')['units']);

        app(WhatsAppService::class)->dispatch();
        $this->assertSame(3, WaMessage::where('wa_campaign_id', $campaign->id)->where('status', 'sent')->count());
        $molefe->refresh();

        $status = function (WaMessage $m, string $status, ?int $code = null) use ($a) {
            $st = ['id' => $m->wamid, 'status' => $status, 'timestamp' => (string) now()->timestamp, 'recipient_id' => $m->phone]
                + ($code ? ['errors' => [['code' => $code, 'title' => 'Message undeliverable.']]] : []);
            $raw = json_encode(['object' => 'whatsapp_business_account', 'entry' => [['id' => '1111111111', 'changes' => [['field' => 'messages', 'value' => [
                'metadata' => ['phone_number_id' => '2222222222'], 'statuses' => [$st],
            ]]]]]]);
            $this->call('POST', "/webhooks/whatsapp/{$a->webhook_key}", [], [], [], [
                'CONTENT_TYPE' => 'application/json', 'HTTP_X_HUB_SIGNATURE_256' => 'sha256=' . hash_hmac('sha256', $raw, 'app-secret-abcdef123456'),
            ], $raw)->assertOk();
        };

        // Contact 1 isn't on WhatsApp → the same message is queued to the next number.
        $status($molefe, 'failed', 131026);
        $next = WaMessage::where('wa_campaign_id', $campaign->id)->where('status', 'queued')->firstOrFail();
        $this->assertSame('27831110002', $next->phone, 'Next number in order: the owner\'s other unit contact');
        $this->assertSame($molefe->body, $next->body);
        $this->assertSame(4, $campaign->fresh()->total);
        $this->assertStringContainsString('not on WhatsApp', $molefe->fresh()->error_message);

        app(WhatsAppService::class)->dispatch();
        $next->refresh();
        $this->assertSame('sent', $next->status);

        // Still undeliverable → contact 2 of unit 1; then nothing left to try.
        $status($next, 'failed', 131026);
        $third = WaMessage::where('wa_campaign_id', $campaign->id)->where('status', 'queued')->firstOrFail();
        $this->assertSame('27831110003', $third->phone);
        app(WhatsAppService::class)->dispatch();
        $status($third->fresh(), 'failed', 131026);
        $this->assertSame(0, WaMessage::where('wa_campaign_id', $campaign->id)->where('status', 'queued')->count(), 'No numbers left');

        // Other failures (not "undeliverable") don't fall back; delivered contact 1 never uses contact 2.
        $dlamini = WaMessage::where('phone', '27611110001')->firstOrFail();
        $status($dlamini, 'failed', 131049);
        $status(WaMessage::where('phone', '27721110001')->firstOrFail(), 'delivered');
        $this->assertSame(0, WaMessage::where('phone', '27611110002')->count());
    }

    #[Test]
    public function a_campaign_sends_personalised_templates_and_feeds_the_crm(): void
    {
        $this->fakeMeta();
        $this->account();
        $p = $this->prospect();
        $this->prospect(['owner_name' => 'BOTHA LINDA', 'unit' => '2', 'phone1' => '0721234567']);
        $this->prospect(['owner_name' => 'NO PHONE', 'unit' => '3', 'phone1' => null]);
        $this->prospect(['owner_name' => 'DUPLICATE NUMBER', 'unit' => '4', 'phone1' => '+27821112222']);

        $this->campaign();
        $campaign = WaCampaign::firstOrFail();
        $this->assertSame(2, $campaign->total, 'No phone and duplicate numbers are left out');

        $sent = app(WhatsAppService::class)->dispatch();
        $this->assertSame(2, $sent);

        Http::assertSent(fn (HttpRequest $r) => str_ends_with($r->url(), '/2222222222/messages')
            && $r['to'] === '27821112222'
            && $r['template']['name'] === 'home_value_report'
            && $r['template']['components'][0]['parameters'][0]['text'] === 'Nkosi Thabo'
            && $r['template']['components'][0]['parameters'][1]['text'] === 'Sipho Dlamini'
            && $r['template']['components'][0]['parameters'][2]['text'] === 'Sunnyside'
            && $r->hasHeader('Authorization', 'Bearer EAAG-test-token-1234567890'));

        $this->assertSame('completed', $campaign->fresh()->status);
        $this->assertSame('attempted', $p->fresh()->status);
        $this->assertSame('whatsapp', $p->fresh()->method);
        $this->assertSame(2, CrmActivity::where('channel', 'whatsapp')->where('outcome', 'sent')->count());
    }

    #[Test]
    public function owners_who_havent_opted_in_need_a_confirmation_but_are_not_blocked(): void
    {
        $this->fakeMeta();
        $this->account();
        $this->prospect();

        $a = WhatsAppAccount::first();
        $t = $this->template($a);
        $this->actingAs($this->agent)->post('/agent/crm/whatsapp/campaigns', [
            'name' => 'X', 'template_id' => $t->id, 'variable_map' => ['1' => 'owner_name', '2' => 'agent_name', '3' => 'suburb'],
            'scheme_ids' => [$this->scheme->id],
        ])->assertSessionHasErrors('confirm_consent');
        $this->assertSame(0, WaCampaign::count());

        $this->campaign(['confirm_consent' => true]);
        $this->assertSame(1, WaCampaign::count());
    }

    #[Test]
    public function the_opt_in_tick_is_recorded_and_can_limit_a_campaign(): void
    {
        $this->fakeMeta();
        $this->account();
        $yes = $this->prospect();
        $this->prospect(['owner_name' => 'NOT YET', 'unit' => '2', 'phone1' => '0721234567']);

        $this->actingAs($this->agent)->patch("/agent/crm/prospects/{$yes->id}", [
            'owner_name' => $yes->owner_name, 'phone1' => $yes->phone1, 'status' => 'contacted', 'wa_opt_in' => true,
        ])->assertSessionHas('success');
        $this->assertNotNull($yes->fresh()->wa_opt_in_at);
        $this->assertSame('agent', $yes->fresh()->wa_opt_in_source);

        // Opted-in only: no confirmation needed, one recipient.
        $t = $this->template(WhatsAppAccount::first());
        $this->actingAs($this->agent)->post('/agent/crm/whatsapp/campaigns', [
            'name' => 'Opted in', 'template_id' => $t->id, 'variable_map' => ['1' => 'owner_name', '2' => 'agent_name', '3' => 'suburb'],
            'scheme_ids' => [$this->scheme->id], 'opted_in_only' => 1,
        ])->assertRedirect();
        $this->assertSame(1, WaCampaign::first()->total);

        $this->actingAs($this->agent)->patch("/agent/crm/prospects/{$yes->id}", [
            'owner_name' => $yes->owner_name, 'status' => 'contacted', 'wa_opt_in' => false,
        ]);
        $this->assertNull($yes->fresh()->wa_opt_in_at);
    }

    #[Test]
    public function safeguards_send_window_frequency_cap_and_opt_out(): void
    {
        $this->fakeMeta();
        $this->account();
        $this->prospect();
        $this->prospect(['owner_name' => 'OPTED OUT', 'unit' => '2', 'phone1' => '0731112222', 'wa_opted_out_at' => now()]);

        // Outside the window nothing goes.
        Carbon::setTestNow(Carbon::parse('2026-10-20 21:00', 'Africa/Johannesburg'));
        $this->campaign();
        $this->assertSame(1, WaCampaign::first()->total, 'Opted-out owners are never queued');
        $this->assertSame(0, app(WhatsAppService::class)->dispatch());

        Carbon::setTestNow(Carbon::parse('2026-10-21 09:00', 'Africa/Johannesburg'));
        $this->assertSame(1, app(WhatsAppService::class)->dispatch());

        // A second campaign to the same number within 30 days is skipped.
        $this->campaign(['name' => 'Again']);
        $this->assertSame(0, app(WhatsAppService::class)->dispatch());
        $this->assertSame('skipped', WaMessage::where('wa_campaign_id', WaCampaign::latest('id')->first()->id)->value('status'));
    }

    #[Test]
    public function an_owners_whatsapp_message_rings_the_agents_bell(): void
    {
        $a = $this->account();
        $this->prospect();
        $post = function (array $msg) use ($a) {
            $raw = json_encode(['object' => 'whatsapp_business_account', 'entry' => [['id' => '1111111111', 'changes' => [['field' => 'messages', 'value' => [
                'metadata' => ['phone_number_id' => '2222222222'], 'messages' => [$msg],
            ]]]]]]);
            $this->call('POST', "/webhooks/whatsapp/{$a->webhook_key}", [], [], [], [
                'CONTENT_TYPE' => 'application/json', 'HTTP_X_HUB_SIGNATURE_256' => 'sha256=' . hash_hmac('sha256', $raw, 'app-secret-abcdef123456'),
            ], $raw)->assertOk();
        };

        $post(['from' => '27821112222', 'id' => 'wamid.IN1', 'timestamp' => (string) now()->timestamp, 'type' => 'text', 'text' => ['body' => 'Hi, yes please send the valuation']]);
        $post(['from' => '27821112222', 'id' => 'wamid.IN1', 'timestamp' => (string) now()->timestamp, 'type' => 'text', 'text' => ['body' => 'Hi, yes please send the valuation']]); // Meta retry

        $this->assertSame(1, $this->agent->fresh()->unreadNotifications()->count(), 'One bell item per message, retries ignored');
        $this->actingAs($this->agent)->get('/agent/crm/whatsapp')->assertOk()
            ->assertInertia(fn (Assert $p) => $p->where('notifications.unread_count', 1)
                ->where('notifications.recent.0.title', 'New WhatsApp message')
                ->where('notifications.recent.0.href', '/agent/crm/whatsapp/chat?phone=27821112222')
                ->where('notifications.recent.0.body', fn ($b) => str_contains($b, 'NKOSI THABO') && str_contains($b, 'yes please send the valuation')));
        $this->assertSame(0, $this->other->fresh()->unreadNotifications()->count(), 'Only the number\'s own agent is notified');

        Carbon::setTestNow(now()->addMinute());
        $post(['from' => '27821112222', 'id' => 'wamid.IN2', 'timestamp' => (string) now()->timestamp, 'type' => 'text', 'text' => ['body' => 'STOP']]);
        $this->actingAs($this->agent)->get('/agent/crm/whatsapp')
            ->assertInertia(fn (Assert $p) => $p->where('notifications.unread_count', 2)->where('notifications.recent.0.title', 'WhatsApp opt-out'));
    }

    #[Test]
    public function an_agent_can_reply_with_attachments_inside_the_24h_window(): void
    {
        \Illuminate\Support\Facades\Storage::fake('local');
        Http::fake([
            'graph.facebook.com/v23.0/2222222222/media' => Http::response(['id' => 'MEDIA123']),
            'graph.facebook.com/v23.0/2222222222/messages' => Http::sequence()
                ->push(['messages' => [['id' => 'wamid.DOC']]])
                ->push(['messages' => [['id' => 'wamid.IMG']]])
                ->push(['messages' => [['id' => 'wamid.AUD']]])
                ->push(['messages' => [['id' => 'wamid.TXT']]]),
        ]);
        $a = $this->account();
        WaMessage::create(['whatsapp_account_id' => $a->id, 'agent_id' => $this->agent->id, 'direction' => 'in', 'type' => 'text',
            'phone' => '27821112222', 'body' => 'Send me the details', 'status' => 'received', 'sent_at' => now()->subHour()]);
        $reply = fn (array $data) => $this->actingAs($this->agent)->post('/agent/crm/whatsapp/chat', $data + ['phone' => '27821112222']);

        // Document with a caption.
        $pdf = \Illuminate\Http\UploadedFile::fake()->create('Valuation report.pdf', 300, 'application/pdf');
        $reply(['body' => 'Here is your valuation', 'attachment' => $pdf])->assertSessionHasNoErrors();
        Http::assertSent(fn ($r) => str_ends_with($r->url(), '/media') && $r->isMultipart());
        Http::assertSent(fn ($r) => str_ends_with($r->url(), '/messages') && $r['type'] === 'document'
            && $r['document']['id'] === 'MEDIA123' && $r['document']['caption'] === 'Here is your valuation'
            && $r['document']['filename'] === 'Valuation report.pdf');
        $doc = WaMessage::where('wamid', 'wamid.DOC')->firstOrFail();
        $this->assertSame('document', $doc->type);
        \Illuminate\Support\Facades\Storage::disk('local')->assertExists($doc->media_path);

        // Photo without a caption.
        $reply(['attachment' => \Illuminate\Http\UploadedFile::fake()->image('unit-4.jpg', 800, 600)])->assertSessionHasNoErrors();
        $this->assertSame('image', WaMessage::where('wamid', 'wamid.IMG')->value('type'));

        // Audio can't carry a caption: the text follows as its own message.
        $reply(['body' => 'Voice note above', 'attachment' => \Illuminate\Http\UploadedFile::fake()->create('note.mp3', 50, 'audio/mpeg')])->assertSessionHasNoErrors();
        $this->assertSame('audio', WaMessage::where('wamid', 'wamid.AUD')->value('type'));
        $this->assertSame('Voice note above', WaMessage::where('wamid', 'wamid.TXT')->value('body'));

        // Unsupported types and empty replies are refused before anything is sent.
        $reply(['attachment' => \Illuminate\Http\UploadedFile::fake()->create('setup.exe', 10, 'application/octet-stream')])->assertSessionHasErrors('attachment');
        $reply(['body' => ''])->assertSessionHasErrors('body');

        // The chat shows the attachment; only its own agent can open the copy.
        $this->actingAs($this->agent)->get('/agent/crm/whatsapp/chat?phone=27821112222')->assertOk()
            ->assertInertia(fn (Assert $p) => $p->where('messages', fn ($ms) => collect($ms)->contains(fn ($m) => ($m['media']['name'] ?? null) === 'Valuation report.pdf')));
        $this->actingAs($this->agent)->get("/agent/crm/whatsapp/media/{$doc->id}")->assertOk();
        $this->actingAs($this->other)->get("/agent/crm/whatsapp/media/{$doc->id}")->assertForbidden();
    }

    #[Test]
    public function the_send_schedule_follows_the_consumer_protection_act(): void
    {
        $at = fn (string $t) => CarbonImmutable::parse($t, 'Africa/Johannesburg');

        // Weekdays 08:00–20:00 (Tue 20 Oct 2026).
        $this->assertFalse(SendSchedule::isOpen(null, $at('2026-10-20 07:59')));
        $this->assertTrue(SendSchedule::isOpen(null, $at('2026-10-20 08:00')));
        $this->assertTrue(SendSchedule::isOpen(null, $at('2026-10-20 19:59')));
        $this->assertFalse(SendSchedule::isOpen(null, $at('2026-10-20 20:00')));
        // Saturdays 09:00–13:00, never Sundays.
        $this->assertFalse(SendSchedule::isOpen(null, $at('2026-10-24 08:30')));
        $this->assertTrue(SendSchedule::isOpen(null, $at('2026-10-24 12:00')));
        $this->assertFalse(SendSchedule::isOpen(null, $at('2026-10-24 13:00')));
        $this->assertFalse(SendSchedule::isOpen(null, $at('2026-10-25 10:00')));
        // Public holidays, incl. Easter-based and the Sunday→Monday rule.
        $this->assertSame('Day of Reconciliation', SendSchedule::publicHoliday($at('2026-12-16')));
        $this->assertSame('Good Friday', SendSchedule::publicHoliday($at('2026-04-03')));
        $this->assertSame('Family Day', SendSchedule::publicHoliday($at('2026-04-06')));
        $this->assertSame('Youth Day (observed)', SendSchedule::publicHoliday($at('2024-06-17')));
        $this->assertFalse(SendSchedule::isOpen(null, $at('2026-12-16 10:00')));
        // After Friday 20:00 the next slot is Saturday 09:00.
        $this->assertSame('2026-10-24 09:00', SendSchedule::nextOpen(null, $at('2026-10-23 20:30'))->format('Y-m-d H:i'));
    }

    #[Test]
    public function an_agent_can_narrow_but_not_widen_their_sending_hours(): void
    {
        $this->fakeMeta();
        $this->account();

        $this->actingAs($this->agent)->post('/agent/crm/whatsapp/schedule', ['send_from' => '06:00', 'send_until' => '17:00', 'send_saturdays' => false])
            ->assertSessionHas('success');
        $a = WhatsAppAccount::firstOrFail();
        $at = fn (string $t) => CarbonImmutable::parse($t, 'Africa/Johannesburg');

        $this->assertFalse(SendSchedule::isOpen($a, $at('2026-10-20 07:00')), 'Cannot start before the legal 08:00');
        $this->assertTrue(SendSchedule::isOpen($a, $at('2026-10-20 16:00')));
        $this->assertFalse(SendSchedule::isOpen($a, $at('2026-10-20 18:00')), 'Own cut-off at 17:00');
        $this->assertFalse(SendSchedule::isOpen($a, $at('2026-10-24 10:00')), 'Saturdays switched off');

        $this->actingAs($this->agent)->post('/agent/crm/whatsapp/schedule', ['send_from' => '15:00', 'send_until' => '09:00', 'send_saturdays' => true])
            ->assertSessionHasErrors('send_until');

        // The dispatcher holds the campaign outside the agent's own hours.
        $this->prospect();
        Carbon::setTestNow(Carbon::parse('2026-10-20 18:00', 'Africa/Johannesburg'));
        $this->campaign();
        $this->assertSame(0, app(WhatsAppService::class)->dispatch());
        Carbon::setTestNow(Carbon::parse('2026-10-21 09:00', 'Africa/Johannesburg'));
        $this->assertSame(1, app(WhatsAppService::class)->dispatch());
    }

    #[Test]
    public function running_out_of_meta_credit_pauses_the_campaign_with_a_clear_reason(): void
    {
        $this->fakeMeta(Http::response(['error' => ['message' => 'Payment issue', 'code' => 131042]], 400));
        $this->account();
        $this->prospect();
        $this->prospect(['owner_name' => 'B', 'unit' => '2', 'phone1' => '0721234567']);
        $this->campaign();

        $this->assertSame(0, app(WhatsAppService::class)->dispatch());
        $c = WaCampaign::first();
        $this->assertSame('paused', $c->status);
        $this->assertStringContainsString('Top up', $c->pause_reason);
        $this->assertSame(2, $c->messages()->where('status', 'queued')->count(), 'Nothing is lost — resume after topping up');

        $this->actingAs($this->agent)->post("/agent/crm/whatsapp/campaigns/{$c->id}/resume")->assertSessionHas('success');
        $this->assertSame('sending', $c->fresh()->status);
    }

    #[Test]
    public function webhooks_track_delivery_replies_and_stop(): void
    {
        $this->fakeMeta();
        $a = $this->account();
        $p = $this->prospect();
        $this->campaign();
        app(WhatsAppService::class)->dispatch();
        $msg = WaMessage::firstOrFail();

        $post = function (array $value) use ($a) {
            $raw = json_encode(['object' => 'whatsapp_business_account', 'entry' => [['id' => '1111111111', 'changes' => [['field' => 'messages', 'value' => ['metadata' => ['phone_number_id' => '2222222222']] + $value]]]]]);

            return $this->call('POST', "/webhooks/whatsapp/{$a->webhook_key}", [], [], [], [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_X_HUB_SIGNATURE_256' => 'sha256=' . hash_hmac('sha256', $raw, 'app-secret-abcdef123456'),
            ], $raw);
        };

        // Handshake
        $this->get("/webhooks/whatsapp/{$a->webhook_key}?hub.mode=subscribe&hub.verify_token={$a->verify_token}&hub.challenge=42")->assertOk()->assertSee('42');
        $this->get("/webhooks/whatsapp/{$a->webhook_key}?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=42")->assertForbidden();

        // Bad signature is rejected
        $this->call('POST', "/webhooks/whatsapp/{$a->webhook_key}", [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_X_HUB_SIGNATURE_256' => 'sha256=bad'], '{}')->assertForbidden();

        $post(['statuses' => [['id' => $msg->wamid, 'status' => 'read', 'timestamp' => (string) now()->timestamp]]])->assertOk();
        $post(['statuses' => [['id' => $msg->wamid, 'status' => 'delivered', 'timestamp' => (string) now()->timestamp]]])->assertOk();
        $this->assertSame('read', $msg->fresh()->status, 'Statuses never move backwards');

        $post(['messages' => [['from' => '27821112222', 'id' => 'wamid.in1', 'timestamp' => (string) now()->timestamp, 'type' => 'text', 'text' => ['body' => 'Yes please send it']]]])->assertOk();
        $this->assertNotNull($msg->fresh()->replied_at);
        $this->assertSame('contacted', $p->fresh()->status);
        $this->assertDatabaseHas('wa_messages', ['direction' => 'in', 'body' => 'Yes please send it', 'crm_prospect_id' => $p->id]);

        $post(['messages' => [['from' => '27821112222', 'id' => 'wamid.in2', 'timestamp' => (string) now()->timestamp, 'type' => 'text', 'text' => ['body' => 'STOP']]]])->assertOk();
        $this->assertNotNull($p->fresh()->wa_opted_out_at);

        // Replies inside 24h are allowed as free text
        $this->actingAs($this->agent)->post('/agent/crm/whatsapp/chat', ['phone' => '0821112222', 'body' => 'Thanks, noted'])->assertRedirect();
        $this->assertDatabaseHas('wa_messages', ['direction' => 'out', 'type' => 'text', 'body' => 'Thanks, noted']);
    }

    #[Test]
    public function a_flagged_number_pauses_sending(): void
    {
        $this->fakeMeta();
        $a = $this->account();
        $this->prospect();
        $this->campaign();

        $raw = json_encode(['entry' => [['changes' => [['field' => 'phone_number_quality_update', 'value' => ['event' => 'FLAGGED', 'current_limit' => 'TIER_250']]]]]]);
        $this->call('POST', "/webhooks/whatsapp/{$a->webhook_key}", [], [], [], [
            'CONTENT_TYPE' => 'application/json', 'HTTP_X_HUB_SIGNATURE_256' => 'sha256=' . hash_hmac('sha256', $raw, 'app-secret-abcdef123456'),
        ], $raw)->assertOk();

        $this->assertSame('paused', WaCampaign::first()->status);
        $this->assertSame(0, app(WhatsAppService::class)->dispatch());
    }

    #[Test]
    public function campaigns_are_private_and_the_agency_sees_results_read_only(): void
    {
        $this->fakeMeta();
        $this->account();
        $this->prospect();
        $this->campaign();
        $c = WaCampaign::first();

        $this->actingAs($this->other)->get("/agent/crm/whatsapp/campaigns/{$c->id}")->assertForbidden();
        $this->actingAs($this->other)->post("/agent/crm/whatsapp/campaigns/{$c->id}/cancel")->assertForbidden();

        $this->actingAs($this->owner)->get('/agency/crm/whatsapp')->assertOk()
            ->assertInertia(fn (Assert $p) => $p->component('Agency/Crm/WhatsApp')
                ->has('campaigns', 1)->where('campaigns.0.agent', 'Sipho Dlamini')
                ->where('numbers', fn ($n) => collect($n)->firstWhere('agent', 'Sipho Dlamini')['status'] === 'connected'
                    && collect($n)->firstWhere('agent', 'Aisha Patel')['status'] === 'not_connected'));
    }
}
