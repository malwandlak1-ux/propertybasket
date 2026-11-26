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
use App\Models\Inquiry;
use App\Models\User;
use App\Models\WaMessage;
use App\Models\WhatsAppAccount;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** Mobile API: agent CRM — farming drill-down, contact logging, pipeline hand-off, WhatsApp inbox. */
class ApiV1AgentCrmTest extends TestCase
{
    use RefreshDatabase;

    private User $agent;
    private User $other;
    private Agency $agency;
    private CrmSuburb $suburb;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $owner = User::factory()->create(['role' => Role::AgencyAdmin, 'status' => UserStatus::Active]);
        $this->agency = Agency::create(['user_id' => $owner->id, 'name' => 'Sandton Realty', 'slug' => 'sandton-' . Str::random(6), 'email' => $owner->email, 'status' => 'active']);
        $this->agent = $this->makeAgent('Sipho Dlamini');
        $this->other = $this->makeAgent('Aisha Patel');
        $this->suburb = CrmSuburb::where('name', 'Sunnyside')->firstOrFail();
    }

    private function makeAgent(string $name): User
    {
        $u = User::factory()->create(['role' => Role::Agent, 'status' => UserStatus::Active, 'name' => $name]);
        $u->assignRole('agent');
        AgencyAgent::create(['agency_id' => $this->agency->id, 'user_id' => $u->id, 'commission_split_percent' => 50,
            'lead_allocation_position' => 0, 'ffc_number' => 'FFC-' . $u->id, 'ffc_expires_at' => now()->addYear(), 'status' => 'active']);

        return $u;
    }

    private function scheme(User $agent, string $name = 'SS Maxbie'): CrmScheme
    {
        return CrmScheme::create(['crm_suburb_id' => $this->suburb->id, 'agency_id' => $this->agency->id, 'agent_id' => $agent->id, 'name' => $name, 'units_count' => 60]);
    }

    private function prospect(CrmScheme $scheme, array $attrs = []): CrmProspect
    {
        return $scheme->prospects()->create($attrs + [
            'agency_id' => $scheme->agency_id, 'agent_id' => $scheme->agent_id,
            'owner_name' => 'J SMITH', 'unit' => '4', 'phone1' => '0821234567', 'status' => 'not_contacted',
        ]);
    }

    #[Test]
    public function farming_drills_from_regions_down_to_a_schemes_owners(): void
    {
        $scheme = $this->scheme($this->agent);
        $this->prospect($scheme);
        $this->scheme($this->other, 'SS Not Mine');

        Sanctum::actingAs($this->agent);

        $this->getJson('/api/v1/agent/crm')->assertOk()->assertJsonPath('component', 'Agent/Crm/Overview')
            ->assertJsonPath('data.data.kpis.prospects', 1);

        $this->getJson('/api/v1/agent/crm/farming')->assertOk()->assertJsonPath('data.farm.level', 'regions');

        $region = $this->suburb->crm_region_id;
        $this->getJson("/api/v1/agent/crm/farming?region={$region}")->assertOk()->assertJsonPath('data.farm.level', 'region');

        $this->getJson("/api/v1/agent/crm/farming?suburb={$this->suburb->id}")->assertOk()
            ->assertJsonPath('data.farm.level', 'suburb')
            ->assertJsonCount(1, 'data.farm.schemes')
            ->assertJsonPath('data.farm.schemes.0.name', 'SS Maxbie')
            ->assertJsonPath('data.farm.schemes.0.owners', 1);

        $this->getJson("/api/v1/agent/crm/farming?scheme={$scheme->id}")->assertOk()
            ->assertJsonPath('data.farm.level', 'scheme')
            ->assertJsonPath('data.farm.prospects.0.owner_name', 'J SMITH');
    }

    #[Test]
    public function an_agent_adds_a_prospect_logs_a_contact_and_updates_status(): void
    {
        $scheme = $this->scheme($this->agent);

        Sanctum::actingAs($this->agent);

        $this->postJson("/api/v1/agent/crm/schemes/{$scheme->id}/prospects", ['unit' => '12'])
            ->assertStatus(422)->assertJsonValidationErrors(['owner_name', 'status']);

        $this->postJson("/api/v1/agent/crm/schemes/{$scheme->id}/prospects", [
            'owner_name' => 'T NKOSI', 'unit' => '12', 'phone1' => '0835550101', 'status' => 'not_contacted',
        ])->assertCreated();

        $p = CrmProspect::where('owner_name', 'T NKOSI')->firstOrFail();
        $this->assertSame($this->agent->id, (int) $p->agent_id);

        // A cold call where the owner was interested moves them forward and is counted.
        $this->postJson('/api/v1/agent/crm/activities', [
            'prospect_id' => $p->id, 'channel' => 'call', 'outcome' => 'interested', 'note' => 'Wants a valuation', 'occurred_on' => now()->toDateString(),
        ])->assertCreated()->assertJsonPath('message', 'Contact logged.');

        $p->refresh();
        $this->assertSame('interested', $p->status);
        $this->assertSame('call', $p->method);
        $this->assertSame(1, CrmActivity::where('crm_prospect_id', $p->id)->count());

        $this->patchJson("/api/v1/agent/crm/prospects/{$p->id}/status", ['status' => 'appraisal_booked'])
            ->assertOk()->assertJsonPath('status', 'appraisal_booked');
        $this->patchJson("/api/v1/agent/crm/prospects/{$p->id}/status", ['status' => 'nonsense'])->assertStatus(422);

        $this->patchJson("/api/v1/agent/crm/prospects/{$p->id}", ['owner_name' => 'T NKOSI', 'status' => 'appraisal_booked', 'next_action' => 'Valuation Friday 10:00'])
            ->assertOk();
        $this->assertSame('Valuation Friday 10:00', $p->fresh()->next_action);
    }

    #[Test]
    public function a_warm_owner_goes_to_the_pipeline_once(): void
    {
        $p = $this->prospect($this->scheme($this->agent), ['status' => 'interested', 'est_value' => 1_200_000]);

        Sanctum::actingAs($this->agent);

        $this->postJson("/api/v1/agent/crm/prospects/{$p->id}/pipeline")->assertCreated();

        $lead = Inquiry::where('source', 'farming')->firstOrFail();
        $this->assertSame('J SMITH', $lead->name);
        $this->assertSame($this->agent->id, (int) $lead->assigned_to);

        // The website refuses a second hand-off with a flash message; the app gets it as a 422.
        $this->postJson("/api/v1/agent/crm/prospects/{$p->id}/pipeline")
            ->assertStatus(422)
            ->assertJsonPath('message', 'This owner is already on your pipeline.');
        $this->assertSame(1, Inquiry::where('source', 'farming')->count());
    }

    #[Test]
    public function another_agents_farming_records_are_off_limits(): void
    {
        $scheme = $this->scheme($this->other);
        $p = $this->prospect($scheme);

        Sanctum::actingAs($this->agent);

        $this->getJson("/api/v1/agent/crm/farming?scheme={$scheme->id}")->assertNotFound();
        $this->postJson("/api/v1/agent/crm/schemes/{$scheme->id}/prospects", ['owner_name' => 'X', 'status' => 'not_contacted'])->assertForbidden();
        $this->patchJson("/api/v1/agent/crm/prospects/{$p->id}/status", ['status' => 'contacted'])->assertForbidden();
        $this->postJson("/api/v1/agent/crm/prospects/{$p->id}/pipeline")->assertForbidden();
        $this->postJson('/api/v1/agent/crm/activities', ['prospect_id' => $p->id, 'channel' => 'call', 'occurred_on' => now()->toDateString()])->assertForbidden();
        $this->assertSame('not_contacted', $p->fresh()->status);
    }

    #[Test]
    public function the_whatsapp_inbox_lists_threads_and_replies_inside_the_24_hour_window(): void
    {
        Http::fake(['graph.facebook.com/v23.0/2222222222/messages' => Http::response(['messages' => [['id' => 'wamid.reply1']]])]);

        Sanctum::actingAs($this->agent);

        // Not connected yet: the tab still loads and says so.
        $this->getJson('/api/v1/agent/crm/whatsapp')->assertOk()->assertJsonPath('data.account', null);

        $account = WhatsAppAccount::create([
            'agent_id' => $this->agent->id, 'agency_id' => $this->agency->id, 'waba_id' => '1111111111', 'phone_number_id' => '2222222222',
            'access_token' => 'EAAG-test-token-1234567890', 'app_secret' => 'app-secret-abcdef123456', 'status' => 'connected', 'quality_rating' => 'GREEN',
        ]);
        $in = fn (string $phone, $at) => WaMessage::create(['whatsapp_account_id' => $account->id, 'agent_id' => $this->agent->id, 'direction' => 'in',
            'type' => 'text', 'phone' => $phone, 'body' => 'Is the valuation free?', 'status' => 'received', 'sent_at' => $at]);
        $in('27821112222', now()->subHour());
        $in('27823334444', now()->subDays(3));

        $this->getJson('/api/v1/agent/crm/whatsapp')->assertOk()->assertJsonCount(2, 'data.threads');

        $this->getJson('/api/v1/agent/crm/whatsapp/chat?phone=27821112222')->assertOk()
            ->assertJsonPath('data.messages.0.body', 'Is the valuation free?')
            ->assertJsonPath('data.messages.0.direction', 'in');

        $this->postJson('/api/v1/agent/crm/whatsapp/chat', ['phone' => '27821112222', 'body' => 'Yes, completely free.'])->assertCreated();
        $this->assertDatabaseHas('wa_messages', ['phone' => '27821112222', 'direction' => 'out', 'body' => 'Yes, completely free.', 'wamid' => 'wamid.reply1']);

        // Outside the window WhatsApp only allows templates; the app gets the website's wording as a 422.
        $this->postJson('/api/v1/agent/crm/whatsapp/chat', ['phone' => '27823334444', 'body' => 'Hello again'])
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'within 24 hours'));
        $this->assertDatabaseMissing('wa_messages', ['body' => 'Hello again']);
    }
}
