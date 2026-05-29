<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\Inquiry;
use App\Models\Landlord;
use App\Models\Listing;
use App\Models\User;
use App\Notifications\InquiryReceived;
use App\Services\InquiryService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class InquiryAllocationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    /**
     * Build an Agency with N active agents (each has its own user).
     * Returns [Agency, User[]] in their lead_allocation_position order.
     */
    private function makeAgencyWithAgents(int $agentCount = 3): array
    {
        $owner = User::factory()->create(['role' => Role::AgencyAdmin, 'status' => UserStatus::Active]);

        $agency = Agency::create([
            'user_id' => $owner->id,
            'name'    => 'Test Agency',
            'slug'    => 'test-agency-' . Str::random(6),
            'email'   => $owner->email,
            'status'  => 'active',
        ]);

        $agents = [];
        for ($i = 0; $i < $agentCount; $i++) {
            $agent = User::factory()->create(['role' => Role::Agent, 'status' => UserStatus::Active]);
            AgencyAgent::create([
                'agency_id'                => $agency->id,
                'user_id'                  => $agent->id,
                'commission_split_percent' => 70,
                'lead_allocation_position' => $i,
                'status'                   => 'active',
            ]);
            $agents[] = $agent;
        }

        return [$agency, $agents];
    }

    private function makeListing(Agency|Landlord $owner): Listing
    {
        return Listing::create([
            'ulid'          => (string) Str::ulid(),
            'owner_type'    => $owner instanceof Agency ? Agency::class : Landlord::class,
            'owner_id'      => $owner->id,
            'title'         => 'Test Listing',
            'slug'          => 'test-' . Str::random(8),
            'description'   => 'A test listing for inquiry allocation.',
            'listing_type'  => 'long_term_rent',
            'property_type' => 'apartment',
            'status'        => 'available',
            'monthly_rent'  => 12_000,
            'bedrooms'      => 2,
            'bathrooms'     => 1,
            'suburb'        => 'Rosebank',
            'city'          => 'Johannesburg',
            'province'      => 'Gauteng',
        ]);
    }

    // ── Agency round-robin ──────────────────────────────────────────────

    #[Test]
    public function first_inquiry_goes_to_the_lowest_position_agent(): void
    {
        [$agency, $agents] = $this->makeAgencyWithAgents(3);
        $listing = $this->makeListing($agency);

        $inquiry = app(InquiryService::class)->createFromWebsite([
            'listing_id' => $listing->id,
            'name'       => 'Buyer Bob',
            'email'      => 'bob@example.test',
            'message'    => 'I want to view this property.',
        ]);

        $this->assertEquals($agents[0]->id, $inquiry->assigned_to);
        $this->assertEquals('round_robin', $inquiry->allocation_method);
        $this->assertNotNull($inquiry->allocated_at);
    }

    #[Test]
    public function consecutive_inquiries_rotate_through_agents(): void
    {
        [$agency, $agents] = $this->makeAgencyWithAgents(3);
        $listing = $this->makeListing($agency);

        $service = app(InquiryService::class);

        $assignments = [];
        for ($i = 0; $i < 6; $i++) {
            $inq = $service->createFromWebsite([
                'listing_id' => $listing->id,
                'name'       => "Buyer {$i}",
                'email'      => "buyer{$i}@example.test",
            ]);
            $assignments[] = $inq->assigned_to;
        }

        // Each agent should receive exactly 2 inquiries across 6 round-robin assignments
        foreach ($agents as $agent) {
            $this->assertEquals(
                2,
                collect($assignments)->filter(fn ($id) => $id === $agent->id)->count(),
                "Agent {$agent->id} should have received exactly 2 inquiries"
            );
        }

        // First three should be in the original position order
        $this->assertEquals(
            [$agents[0]->id, $agents[1]->id, $agents[2]->id],
            array_slice($assignments, 0, 3)
        );
    }

    #[Test]
    public function inquiries_count_on_listing_increments(): void
    {
        [$agency, ] = $this->makeAgencyWithAgents(2);
        $listing = $this->makeListing($agency);

        $this->assertEquals(0, $listing->inquiries_count);

        app(InquiryService::class)->createFromWebsite([
            'listing_id' => $listing->id,
            'name'       => 'A',
            'email'      => 'a@example.test',
        ]);
        app(InquiryService::class)->createFromWebsite([
            'listing_id' => $listing->id,
            'name'       => 'B',
            'email'      => 'b@example.test',
        ]);

        $this->assertEquals(2, $listing->fresh()->inquiries_count);
    }

    // ── Edge cases ──────────────────────────────────────────────────────

    #[Test]
    public function inquiry_for_agency_with_no_agents_falls_back_to_owner(): void
    {
        $owner = User::factory()->create(['role' => Role::AgencyAdmin]);
        $agency = Agency::create([
            'user_id' => $owner->id,
            'name'    => 'Solo Agency',
            'slug'    => 'solo-' . Str::random(6),
            'email'   => $owner->email,
            'status'  => 'active',
        ]);

        $listing = $this->makeListing($agency);

        $inquiry = app(InquiryService::class)->createFromWebsite([
            'listing_id' => $listing->id,
            'name'       => 'Buyer',
            'email'      => 'buyer@example.test',
        ]);

        $this->assertEquals($owner->id, $inquiry->assigned_to);
    }

    #[Test]
    public function inactive_agents_are_skipped(): void
    {
        [$agency, $agents] = $this->makeAgencyWithAgents(3);

        // Suspend the first agent
        AgencyAgent::where('user_id', $agents[0]->id)->update(['status' => 'suspended']);

        $listing = $this->makeListing($agency);

        $inquiry = app(InquiryService::class)->createFromWebsite([
            'listing_id' => $listing->id,
            'name'       => 'Buyer',
            'email'      => 'buyer@example.test',
        ]);

        $this->assertEquals($agents[1]->id, $inquiry->assigned_to);
        $this->assertNotEquals($agents[0]->id, $inquiry->assigned_to);
    }

    // ── Landlord-owned listings ─────────────────────────────────────────

    #[Test]
    public function landlord_listing_routes_inquiry_to_the_landlord_user(): void
    {
        $landlordUser = User::factory()->create(['role' => Role::Landlord, 'status' => UserStatus::Active]);
        $landlord     = Landlord::create(['user_id' => $landlordUser->id]);

        $listing = $this->makeListing($landlord);

        $inquiry = app(InquiryService::class)->createFromWebsite([
            'listing_id' => $listing->id,
            'name'       => 'Buyer',
            'email'      => 'buyer@example.test',
        ]);

        $this->assertEquals($landlordUser->id, $inquiry->assigned_to);
        // Landlord direct ownership should NOT be marked as round-robin
        $this->assertNull($inquiry->allocation_method);
    }

    // ── Public endpoint ─────────────────────────────────────────────────

    #[Test]
    public function public_inquiry_endpoint_creates_and_allocates(): void
    {
        Notification::fake();

        [$agency, $agents] = $this->makeAgencyWithAgents(2);
        $listing = $this->makeListing($agency);

        $this->post('/inquiries', [
            'listing_id' => $listing->id,
            'name'       => 'Sam Public',
            'email'      => 'sam@example.test',
            'phone'      => '+27 82 555 1234',
            'message'    => 'Interested!',
        ])
            ->assertRedirect("/properties/{$listing->slug}")
            ->assertSessionHas('success');

        $this->assertDatabaseHas('inquiries', [
            'listing_id'  => $listing->id,
            'email'       => 'sam@example.test',
            'assigned_to' => $agents[0]->id,
            'source'      => 'website',
            'status'      => 'new',
        ]);

        Notification::assertSentTo($agents[0], InquiryReceived::class);
    }

    #[Test]
    public function public_endpoint_validates_required_fields(): void
    {
        $this->from('/properties')
            ->post('/inquiries', [])
            ->assertSessionHasErrors(['listing_id', 'name', 'email']);
    }

    #[Test]
    public function public_endpoint_rejects_unknown_listing(): void
    {
        $this->from('/properties')
            ->post('/inquiries', [
                'listing_id' => 99999,
                'name'       => 'X',
                'email'      => 'x@example.test',
            ])
            ->assertSessionHasErrors('listing_id');
    }

    #[Test]
    public function notification_is_sent_to_the_assigned_agent(): void
    {
        Notification::fake();

        [$agency, $agents] = $this->makeAgencyWithAgents(3);
        $listing = $this->makeListing($agency);

        app(InquiryService::class)->createFromWebsite([
            'listing_id' => $listing->id,
            'name'       => 'X',
            'email'      => 'x@example.test',
        ]);

        Notification::assertSentTo($agents[0], InquiryReceived::class);
        Notification::assertNotSentTo($agents[1], InquiryReceived::class);
        Notification::assertNotSentTo($agents[2], InquiryReceived::class);
    }
}
