<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\Inquiry;
use App\Models\Listing;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** Pipeline ↔ viewings calendar: viewing date/time on leads, calendar popups, Disqualified stage. */
class PipelineViewingsTest extends TestCase
{
    use RefreshDatabase;

    private User $agent;
    private User $other;
    private Listing $listing;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        Carbon::setTestNow(Carbon::parse('2026-10-26 09:00', 'Africa/Johannesburg'));

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

    private function lead(array $attrs = []): Inquiry
    {
        return Inquiry::create($attrs + [
            'listing_id' => $this->listing->id, 'name' => 'Tebogo Maseko', 'email' => 'tebogo@example.test',
            'phone' => '0821234567', 'assigned_to' => $this->agent->id, 'source' => 'agent_manual', 'status' => 'qualified',
        ]);
    }

    #[Test]
    public function a_lead_added_at_the_viewing_stage_needs_a_date_and_lands_on_the_calendar(): void
    {
        $base = ['listing_id' => $this->listing->id, 'name' => 'Lerato M', 'email' => 'lerato@example.test', 'initial_stage' => 'viewing'];

        $this->actingAs($this->agent)->post('/agent/pipeline/leads', $base)->assertSessionHasErrors('viewing_date');

        $this->actingAs($this->agent)->post('/agent/pipeline/leads', $base + ['viewing_date' => '2026-10-28', 'viewing_time' => '14:30'])
            ->assertSessionHas('success');
        $lead = Inquiry::where('email', 'lerato@example.test')->firstOrFail();
        $this->assertSame('2026-10-28 14:30', $lead->viewing_scheduled_at->format('Y-m-d H:i'));

        $this->actingAs($this->agent)->get('/agent/viewings?view=week&cursor=2026-10-28')->assertOk()
            ->assertInertia(fn (Assert $p) => $p->component('Agent/Viewings')
                ->has('viewings', 1)
                ->where('viewings.0.time', '14:30')
                // Entry carries the full lead so the calendar opens the same popup as the pipeline.
                ->where('viewings.0.lead.visitor_name', 'Lerato M')
                ->where('viewings.0.lead.email', 'lerato@example.test')
                ->where('viewings.0.lead.listing_title', 'Sunny 2-bed')
                ->where('viewings.0.lead.viewing_date', '2026-10-28')
                ->where('viewings.0.lead.viewing_time', '14:30'));

        // Other stages may add a date optionally; a time without a date is refused.
        $this->actingAs($this->agent)->post('/agent/pipeline/leads', ['listing_id' => $this->listing->id, 'name' => 'X', 'email' => 'x@example.test', 'viewing_time' => '10:00'])
            ->assertSessionHasErrors('viewing_date');
    }

    #[Test]
    public function scheduling_from_the_lead_popup_moves_it_to_viewing_and_can_be_cleared(): void
    {
        $lead = $this->lead();

        $this->actingAs($this->agent)->patch("/agent/pipeline/leads/{$lead->id}/viewing", ['viewing_date' => '2026-10-29', 'viewing_time' => '09:15'])
            ->assertSessionHas('success');
        $lead->refresh();
        $this->assertSame('viewing', $lead->status, 'Qualified lead moves into Viewing');
        $this->assertSame('2026-10-29 09:15', $lead->viewing_scheduled_at->format('Y-m-d H:i'));

        // A later-stage lead keeps its stage when rescheduled.
        $lead->update(['status' => 'offer']);
        $this->actingAs($this->agent)->patch("/agent/pipeline/leads/{$lead->id}/viewing", ['viewing_date' => '2026-10-30', 'viewing_time' => '11:00']);
        $this->assertSame('offer', $lead->fresh()->status);

        $this->actingAs($this->agent)->patch("/agent/pipeline/leads/{$lead->id}/viewing", ['viewing_date' => null, 'viewing_time' => null])
            ->assertSessionHas('success');
        $this->assertNull($lead->fresh()->viewing_scheduled_at);

        // Only the lead's own agent.
        $this->actingAs($this->other)->patch("/agent/pipeline/leads/{$lead->id}/viewing", ['viewing_date' => '2026-10-30', 'viewing_time' => '11:00'])
            ->assertForbidden();
    }

    #[Test]
    public function leads_can_be_disqualified_and_get_their_own_column(): void
    {
        $lead = $this->lead();

        $this->actingAs($this->agent)->patch("/agent/pipeline/leads/{$lead->id}/status", ['status' => 'disqualified'])->assertNoContent();
        $this->assertSame('disqualified', $lead->fresh()->status);

        $this->actingAs($this->agent)->get('/agent/crm/pipeline')->assertOk()
            ->assertInertia(fn (Assert $p) => $p->component('Agent/Pipeline')
                ->where('columns', fn ($cols) => collect($cols)->pluck('key')->last() === 'disqualified')
                ->where('columns', fn ($cols) => collect($cols)->firstWhere('key', 'disqualified')['count'] === 1)
                ->where('total_value', 0)); // disqualified deals don't count as pipeline value

        // Agents still can't touch the agency-only Registered stage.
        $this->actingAs($this->agent)->patch("/agent/pipeline/leads/{$lead->id}/status", ['status' => 'registered'])->assertSessionHasErrors('status');
    }
}
