<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\AgentReminder;
use App\Models\Inquiry;
use App\Models\Listing;
use App\Models\PushToken;
use App\Models\User;
use App\Notifications\Channels\ExpoPushChannel;
use App\Notifications\ReminderDue;
use Carbon\CarbonImmutable;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** Mobile API: agent Calendar (viewings + reminders) and Expo push tokens. */
class ApiV1AgentCalendarTest extends TestCase
{
    use RefreshDatabase;

    private const TOKEN = 'ExponentPushToken[abc123]';

    private User $agent;
    private User $other;
    private Listing $listing;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        Carbon::setTestNow(Carbon::parse('2026-11-09 09:00'));

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

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function makeAgent(Agency $agency): User
    {
        $u = User::factory()->create(['role' => Role::Agent, 'status' => UserStatus::Active]);
        $u->assignRole('agent');
        AgencyAgent::create(['agency_id' => $agency->id, 'user_id' => $u->id, 'commission_split_percent' => 50,
            'lead_allocation_position' => 0, 'ffc_number' => 'FFC-' . $u->id, 'ffc_expires_at' => CarbonImmutable::now()->addYear(), 'status' => 'active']);

        return $u;
    }

    #[Test]
    public function calendar_returns_the_weeks_viewings_and_reminders_as_json(): void
    {
        Inquiry::create(['listing_id' => $this->listing->id, 'name' => 'Thandi Mokoena', 'email' => 't@example.test',
            'assigned_to' => $this->agent->id, 'status' => 'viewing', 'source' => 'agent_manual', 'allocation_method' => 'manual',
            'viewing_scheduled_at' => '2026-11-10 10:00:00']);
        AgentReminder::create(['agent_id' => $this->agent->id, 'title' => 'Call bank', 'remind_at' => '2026-11-11 14:30:00']);
        AgentReminder::create(['agent_id' => $this->other->id, 'title' => 'Not mine', 'remind_at' => '2026-11-11 15:00:00']);

        Sanctum::actingAs($this->agent);

        $this->getJson('/api/v1/agent/calendar?view=week&cursor=2026-11-10')
            ->assertOk()
            ->assertJsonPath('component', 'Agent/Viewings')
            ->assertJsonCount(7, 'data.days')
            ->assertJsonPath('data.viewings.0.name', 'Thandi Mokoena')
            ->assertJsonPath('data.viewings.0.time', '10:00')
            ->assertJsonCount(1, 'data.reminders')
            ->assertJsonPath('data.reminders.0.title', 'Call bank');
    }

    #[Test]
    public function an_agent_schedules_a_viewing_and_sets_reminders_from_the_app(): void
    {
        Sanctum::actingAs($this->agent);

        $this->postJson('/api/v1/agent/calendar/viewings', [
            'listing_id' => $this->listing->id, 'name' => 'Sipho Buyer', 'phone' => '0821234567', 'scheduled_at' => '2026-11-12 11:00',
        ])->assertCreated();

        $this->assertDatabaseHas('inquiries', ['name' => 'Sipho Buyer', 'assigned_to' => $this->agent->id, 'status' => 'viewing']);

        $this->postJson('/api/v1/agent/calendar/reminders', ['title' => 'Send offer form', 'remind_at' => '2026-11-12 16:00'])
            ->assertCreated();

        $reminder = AgentReminder::where('title', 'Send offer form')->firstOrFail();
        $this->assertSame($this->agent->id, (int) $reminder->agent_id);

        $this->patchJson("/api/v1/agent/calendar/reminders/{$reminder->id}")->assertOk()->assertJsonPath('done', true);
        $this->patchJson("/api/v1/agent/calendar/reminders/{$reminder->id}")->assertOk()->assertJsonPath('done', false);

        $this->deleteJson("/api/v1/agent/calendar/reminders/{$reminder->id}")->assertOk();
        $this->assertModelMissing($reminder);
    }

    #[Test]
    public function validation_errors_come_back_as_422_json(): void
    {
        Sanctum::actingAs($this->agent);

        $this->postJson('/api/v1/agent/calendar/reminders', ['remind_at' => 'not-a-date'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['title', 'remind_at']);

        $this->postJson('/api/v1/agent/calendar/viewings', ['listing_id' => $this->listing->id, 'name' => 'Late', 'scheduled_at' => '2026-11-01 10:00'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['scheduled_at']);
    }

    #[Test]
    public function an_agent_cannot_touch_someone_elses_reminder(): void
    {
        $theirs = AgentReminder::create(['agent_id' => $this->other->id, 'title' => 'Private', 'remind_at' => '2026-11-11 15:00:00']);

        Sanctum::actingAs($this->agent);

        $this->patchJson("/api/v1/agent/calendar/reminders/{$theirs->id}")->assertForbidden();
        $this->deleteJson("/api/v1/agent/calendar/reminders/{$theirs->id}")->assertForbidden();
        $this->assertModelExists($theirs);
    }

    #[Test]
    public function the_app_registers_and_removes_its_push_token(): void
    {
        Sanctum::actingAs($this->agent);

        $this->postJson('/api/v1/push-tokens', ['token' => 'not-an-expo-token'])->assertStatus(422);

        $this->postJson('/api/v1/push-tokens', ['token' => self::TOKEN, 'platform' => 'android'])->assertCreated();
        $this->assertDatabaseHas('push_tokens', ['token' => self::TOKEN, 'user_id' => $this->agent->id]);

        // Someone else signs in on the same phone: the token moves to them.
        Sanctum::actingAs($this->other);
        $this->postJson('/api/v1/push-tokens', ['token' => self::TOKEN, 'platform' => 'android'])->assertCreated();
        $this->assertSame(1, PushToken::count());
        $this->assertSame($this->other->id, (int) PushToken::first()->user_id);

        // The previous user can't remove it any more; the owner can.
        Sanctum::actingAs($this->agent);
        $this->deleteJson('/api/v1/push-tokens', ['token' => self::TOKEN])->assertOk();
        $this->assertSame(1, PushToken::count());

        Sanctum::actingAs($this->other);
        $this->deleteJson('/api/v1/push-tokens', ['token' => self::TOKEN])->assertOk();
        $this->assertSame(0, PushToken::count());
    }

    #[Test]
    public function a_due_reminder_is_pushed_to_the_agents_phone(): void
    {
        Http::fake([ExpoPushChannel::ENDPOINT => Http::response(['data' => [['status' => 'ok', 'id' => 'tkt-1']]])]);

        PushToken::create(['user_id' => $this->agent->id, 'token' => self::TOKEN, 'platform' => 'android']);
        AgentReminder::create(['agent_id' => $this->agent->id, 'title' => 'Call Mrs Dlamini', 'remind_at' => '2026-11-09 08:55:00']);

        $this->artisan('reminders:send')->assertSuccessful();

        Http::assertSent(fn ($req) => $req->url() === ExpoPushChannel::ENDPOINT
            && $req[0]['to'] === self::TOKEN
            && $req[0]['body'] === 'Call Mrs Dlamini'
            && $req[0]['data']->type === 'reminder');

        // The bell entry is still written.
        $this->assertSame(1, $this->agent->notifications()->where('type', ReminderDue::class)->count());
    }

    #[Test]
    public function no_push_is_attempted_for_agents_without_the_app_and_dead_tokens_are_dropped(): void
    {
        Http::fake([ExpoPushChannel::ENDPOINT => Http::response(['data' => [
            ['status' => 'error', 'message' => 'gone', 'details' => ['error' => 'DeviceNotRegistered']],
        ]])]);

        // Agent without a token: bell only, no HTTP call.
        AgentReminder::create(['agent_id' => $this->other->id, 'title' => 'No app', 'remind_at' => '2026-11-09 08:50:00']);
        $this->artisan('reminders:send')->assertSuccessful();
        Http::assertNothingSent();

        // Agent whose app was uninstalled: Expo says DeviceNotRegistered → token removed.
        PushToken::create(['user_id' => $this->agent->id, 'token' => self::TOKEN]);
        AgentReminder::create(['agent_id' => $this->agent->id, 'title' => 'Uninstalled', 'remind_at' => '2026-11-09 08:58:00']);
        $this->artisan('reminders:send')->assertSuccessful();
        $this->assertSame(0, PushToken::count());
    }
}
