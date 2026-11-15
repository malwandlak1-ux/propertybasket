<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\Conversation;
use App\Models\Inquiry;
use App\Models\Listing;
use App\Models\Message;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** Mobile API: the agent tabs' read endpoints, leads writes and messages. */
class ApiV1AgentTabsTest extends TestCase
{
    use RefreshDatabase;

    private User $agent;
    private User $other;
    private Listing $listing;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $owner = User::factory()->create(['role' => Role::AgencyAdmin, 'status' => UserStatus::Active]);
        $agency = Agency::create(['user_id' => $owner->id, 'name' => 'Test Agency', 'slug' => 'ta-' . Str::random(6), 'email' => $owner->email, 'status' => 'active']);
        $this->agent = $this->makeAgent($agency);
        $this->other = $this->makeAgent($agency);

        $this->listing = Listing::create([
            'ulid' => (string) Str::ulid(), 'owner_type' => Agency::class, 'owner_id' => $agency->id,
            'title' => 'Sunny 2-bed', 'slug' => 'sunny-' . Str::random(8), 'description' => 'Test listing.',
            'listing_type' => 'long_term_rent', 'property_type' => 'apartment', 'status' => 'available',
            'monthly_rent' => 9_500, 'bedrooms' => 2, 'bathrooms' => 1, 'suburb' => 'Montana', 'city' => 'Pretoria', 'province' => 'Gauteng',
        ]);
    }

    private function makeAgent(Agency $agency): User
    {
        $u = User::factory()->create(['role' => Role::Agent, 'status' => UserStatus::Active]);
        $u->assignRole('agent');
        AgencyAgent::create(['agency_id' => $agency->id, 'user_id' => $u->id, 'commission_split_percent' => 50,
            'lead_allocation_position' => 0, 'ffc_number' => 'FFC-' . $u->id, 'ffc_expires_at' => CarbonImmutable::now()->addYear(), 'status' => 'active']);

        return $u;
    }

    private function lead(User $agent, string $status = 'new'): Inquiry
    {
        return Inquiry::create(['listing_id' => $this->listing->id, 'name' => 'Thandi Mokoena', 'email' => 't@example.test',
            'assigned_to' => $agent->id, 'status' => $status, 'source' => 'agent_manual', 'allocation_method' => 'manual']);
    }

    public static function tabs(): array
    {
        return [
            ['overview', 'Agent/Overview'], ['pipeline', 'Agent/Pipeline'], ['listings', 'Agent/Listings'],
            ['calendar', 'Agent/Viewings'], ['messages', 'Agent/Messages'], ['tenants', 'Agent/Tenants'],
            ['maintenance', 'Agent/Maintenance'], ['commission', 'Agent/Commission'], ['analytics', 'Agent/Analytics'],
            ['inspections', 'Agent/Inspections'], ['ffc', 'Agent/FfcCompliance'], ['settings', 'Agent/Settings'],
            ['crm', 'Agent/Crm/Overview'],
        ];
    }

    #[Test]
    #[DataProvider('tabs')]
    public function each_agent_tab_returns_its_page_props(string $path, string $component): void
    {
        Sanctum::actingAs($this->agent);

        $this->getJson("/api/v1/agent/{$path}")
            ->assertOk()
            ->assertJsonPath('component', $component)
            ->assertJsonStructure(['data']);
    }

    #[Test]
    public function agent_tabs_need_a_token_and_the_agent_role(): void
    {
        $this->getJson('/api/v1/agent/tenants')->assertUnauthorized();

        $tenant = User::factory()->create(['role' => Role::Tenant, 'status' => UserStatus::Active]);
        $tenant->assignRole('tenant');
        Sanctum::actingAs($tenant);

        $this->getJson('/api/v1/agent/tenants')->assertForbidden();
    }

    #[Test]
    public function an_agent_moves_and_schedules_only_their_own_unlocked_leads(): void
    {
        $mine = $this->lead($this->agent);
        $theirs = $this->lead($this->other);
        $locked = $this->lead($this->agent, 'registered');

        Sanctum::actingAs($this->agent);

        $this->patchJson("/api/v1/agent/pipeline/leads/{$mine->id}/status", ['status' => 'qualified'])
            ->assertOk()->assertJsonPath('status', 'qualified');

        $this->patchJson("/api/v1/agent/pipeline/leads/{$theirs->id}/status", ['status' => 'qualified'])->assertForbidden();
        $this->assertSame('new', $theirs->fresh()->status);

        $this->patchJson("/api/v1/agent/pipeline/leads/{$locked->id}/status", ['status' => 'closed'])->assertStatus(422);
        $this->assertSame('registered', $locked->fresh()->status);

        $this->patchJson("/api/v1/agent/pipeline/leads/{$mine->id}/status", ['status' => 'registered'])
            ->assertStatus(422)->assertJsonValidationErrors(['status']);

        // Scheduling a viewing moves an early-stage lead to Viewing and puts it on the calendar.
        $date = CarbonImmutable::now()->addDays(2)->format('Y-m-d');
        $this->patchJson("/api/v1/agent/pipeline/leads/{$mine->id}/viewing", ['viewing_date' => $date, 'viewing_time' => '10:30'])
            ->assertOk()->assertJsonPath('message', 'Viewing scheduled.');
        $this->assertSame('viewing', $mine->fresh()->status);
        $this->assertSame("{$date} 10:30", $mine->fresh()->viewing_scheduled_at->format('Y-m-d H:i'));

        $this->patchJson("/api/v1/agent/pipeline/leads/{$theirs->id}/viewing", ['viewing_date' => $date, 'viewing_time' => '10:30'])
            ->assertForbidden();
    }

    #[Test]
    public function an_agent_adds_a_lead_from_the_app(): void
    {
        Sanctum::actingAs($this->agent);

        $this->postJson('/api/v1/agent/pipeline/leads', ['listing_id' => $this->listing->id, 'name' => 'No Email'])
            ->assertStatus(422)->assertJsonValidationErrors(['email']);

        $this->postJson('/api/v1/agent/pipeline/leads', [
            'listing_id' => $this->listing->id, 'name' => 'New Buyer', 'email' => 'buyer@example.test', 'phone' => '0821234567',
        ])->assertCreated();

        $this->assertDatabaseHas('inquiries', ['name' => 'New Buyer', 'assigned_to' => $this->agent->id, 'status' => 'new', 'source' => 'agent_manual']);
    }

    #[Test]
    public function an_agent_reads_and_replies_in_their_own_conversations_only(): void
    {
        $conv = Conversation::create(['type' => 'agency_agent', 'participants' => [$this->agent->id, $this->other->id]]);
        Message::create(['conversation_id' => $conv->id, 'sender_id' => $this->other->id, 'body' => 'Can you take the Montana viewing?']);

        $outsider = User::factory()->create(['role' => Role::Agent, 'status' => UserStatus::Active]);
        $private = Conversation::create(['type' => 'agency_agent', 'participants' => [$this->other->id, $outsider->id]]);

        Sanctum::actingAs($this->agent);

        $this->getJson('/api/v1/agent/messages')
            ->assertOk()
            ->assertJsonCount(1, 'data.conversations')
            ->assertJsonPath('data.conversations.0.unread_count', 1)
            ->assertJsonPath('data.active', null);

        // Opening the thread returns its messages and marks them read.
        $this->getJson("/api/v1/agent/messages?conversation_id={$conv->id}")
            ->assertOk()
            ->assertJsonPath('data.active.id', $conv->id)
            ->assertJsonPath('data.messages.1.body', 'Can you take the Montana viewing?')
            ->assertJsonPath('data.messages.1.is_self', false);
        $this->assertNotNull(Message::first()->read_at);

        $this->postJson("/api/v1/agent/messages/{$conv->id}", ['body' => 'Yes, I will.'])->assertCreated();
        $this->assertDatabaseHas('messages', ['conversation_id' => $conv->id, 'sender_id' => $this->agent->id, 'body' => 'Yes, I will.']);

        $this->postJson("/api/v1/agent/messages/{$conv->id}", ['body' => ''])->assertStatus(422);
        $this->postJson("/api/v1/agent/messages/{$private->id}", ['body' => 'Let me in'])->assertForbidden();
        $this->getJson("/api/v1/agent/messages?conversation_id={$private->id}")->assertOk()->assertJsonPath('data.active', null);
    }
}
