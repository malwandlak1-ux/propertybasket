<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\AgentReminder;
use App\Models\Inquiry;
use App\Models\Listing;
use App\Models\User;
use App\Notifications\ReminderDue;
use Carbon\CarbonImmutable;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** Agent Calendar (/agent/viewings): reminders next to viewings, bell when due. */
class AgentCalendarRemindersTest extends TestCase
{
    use RefreshDatabase;

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
        $agency->activateSubscription('promo', now()->addYear());
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
    public function an_agent_adds_a_reminder_and_sees_it_on_their_calendar_only(): void
    {
        $this->actingAs($this->agent)->post('/agent/viewings/reminders', [
            'title' => 'Call Mrs Dlamini back', 'notes' => 'About the valuation', 'remind_at' => '2026-11-11 14:30:00', 'view' => 'week',
        ])->assertRedirect('/agent/viewings?view=week&cursor=2026-11-11');

        $this->actingAs($this->agent)->get('/agent/viewings?view=week&cursor=2026-11-11')->assertOk()
            ->assertInertia(fn (Assert $p) => $p->component('Agent/Viewings')
                ->has('reminders', 1)
                ->where('reminders.0.title', 'Call Mrs Dlamini back')
                ->where('reminders.0.date', '2026-11-11')
                ->where('reminders.0.time', '14:30')
                ->where('reminders.0.done', false));

        $this->actingAs($this->other)->get('/agent/viewings?view=week&cursor=2026-11-11')->assertOk()
            ->assertInertia(fn (Assert $p) => $p->has('reminders', 0));

        $this->actingAs($this->agent)->post('/agent/viewings/reminders', ['title' => '', 'remind_at' => ''])
            ->assertSessionHasErrors(['title', 'remind_at']);
    }

    #[Test]
    public function only_the_owner_can_mark_done_or_delete_a_reminder(): void
    {
        $r = AgentReminder::create(['agent_id' => $this->agent->id, 'title' => 'Renew mandate', 'remind_at' => '2026-11-10 10:00']);

        $this->actingAs($this->other)->patch("/agent/viewings/reminders/{$r->id}")->assertForbidden();
        $this->actingAs($this->other)->delete("/agent/viewings/reminders/{$r->id}")->assertForbidden();

        $this->actingAs($this->agent)->patch("/agent/viewings/reminders/{$r->id}")->assertRedirect();
        $this->assertNotNull($r->fresh()->done_at);
        $this->actingAs($this->agent)->patch("/agent/viewings/reminders/{$r->id}");
        $this->assertNull($r->fresh()->done_at);

        $this->actingAs($this->agent)->delete("/agent/viewings/reminders/{$r->id}")->assertRedirect();
        $this->assertModelMissing($r);
    }

    #[Test]
    public function the_bell_rings_once_when_a_reminder_is_due(): void
    {
        Notification::fake();
        $due    = AgentReminder::create(['agent_id' => $this->agent->id, 'title' => 'Due now', 'remind_at' => now()->subMinute()]);
        $later  = AgentReminder::create(['agent_id' => $this->agent->id, 'title' => 'Later', 'remind_at' => now()->addHour()]);
        $done   = AgentReminder::create(['agent_id' => $this->agent->id, 'title' => 'Done', 'remind_at' => now()->subHour(), 'done_at' => now()]);

        $this->artisan('reminders:send')->assertSuccessful();
        $this->artisan('reminders:send')->assertSuccessful();

        Notification::assertSentToTimes($this->agent, ReminderDue::class, 1);
        $this->assertNotNull($due->fresh()->notified_at);
        $this->assertNull($later->fresh()->notified_at);
        $this->assertNull($done->fresh()->notified_at);
    }

    #[Test]
    public function a_viewing_can_be_booked_without_an_email(): void
    {
        $this->actingAs($this->agent)->post('/agent/viewings', [
            'listing_id' => $this->listing->id, 'name' => 'Sipho N', 'phone' => '0821234567', 'scheduled_at' => '2026-11-12 11:00:00',
        ])->assertSessionHasNoErrors()->assertRedirect();

        $this->assertSame(1, Inquiry::where('name', 'Sipho N')->whereNull('email')->where('status', 'viewing')->count());
    }
}
