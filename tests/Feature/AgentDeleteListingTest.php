<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\Lease;
use App\Models\Listing;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** Agents can delete their own listings (not leased or sold ones). */
class AgentDeleteListingTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;

    private User $agent;

    private User $other;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        $owner = User::factory()->create(['role' => Role::AgencyAdmin, 'status' => UserStatus::Active]);
        $owner->assignRole('agency_admin');
        $this->agency = Agency::create(['user_id' => $owner->id, 'name' => 'Basket Realty', 'slug' => 'br-' . Str::random(6), 'email' => $owner->email, 'status' => 'active']);
        $this->agency->activateSubscription('promo', now()->addYear());
        $this->agent = $this->makeAgent();
        $this->other = $this->makeAgent();
    }

    private function makeAgent(): User
    {
        $u = User::factory()->create(['role' => Role::Agent, 'status' => UserStatus::Active]);
        $u->assignRole('agent');
        AgencyAgent::create(['agency_id' => $this->agency->id, 'user_id' => $u->id, 'commission_split_percent' => 50, 'lead_allocation_position' => 0,
            'ffc_number' => 'FFC-' . $u->id, 'ffc_certificate_path' => 'ffc/x.pdf', 'ffc_expires_at' => CarbonImmutable::now()->addYear(), 'status' => 'active']);

        return $u;
    }

    private function listing(User $agent, string $status = 'available', string $type = 'long_term_rent'): Listing
    {
        return Listing::create([
            'ulid' => (string) Str::ulid(), 'owner_type' => Agency::class, 'owner_id' => $this->agency->id, 'agent_id' => $agent->id,
            'title' => 'Flat ' . Str::random(4), 'slug' => 'flat-' . Str::random(8), 'listing_type' => $type, 'property_type' => 'apartment',
            'status' => $status, 'monthly_rent' => 9000, 'sale_price' => 1500000, 'suburb' => 'Sandton', 'city' => 'Johannesburg',
        ]);
    }

    #[Test]
    public function an_agent_deletes_their_own_listing(): void
    {
        $l = $this->listing($this->agent);
        $this->actingAs($this->agent)->get('/agent/listings')->assertInertia(fn (Assert $p) => $p->where('listings.0.can_delete', true));

        $this->actingAs($this->agent)->delete("/agent/listings/{$l->id}")->assertRedirect('/agent/listings')->assertSessionHas('success');
        $this->assertSoftDeleted('listings', ['id' => $l->id]);
        $this->actingAs($this->agent)->get('/agent/listings')->assertInertia(fn (Assert $p) => $p->where('listings', []));
        $this->get("/properties/{$l->slug}")->assertNotFound();
    }

    #[Test]
    public function agents_cannot_delete_someone_elses_listing(): void
    {
        $l = $this->listing($this->other);
        $this->actingAs($this->agent)->delete("/agent/listings/{$l->id}")->assertForbidden();
        $this->assertNotSoftDeleted('listings', ['id' => $l->id]);
    }

    #[Test]
    public function leased_and_sold_listings_are_kept(): void
    {
        $leased = $this->listing($this->agent, 'leased');
        $tenant = User::factory()->create(['role' => Role::Tenant, 'status' => UserStatus::Active]);
        Lease::create(['listing_id' => $leased->id, 'tenant_id' => $tenant->id, 'agency_id' => $this->agency->id, 'agent_id' => $this->agent->id,
            'start_date' => now(), 'end_date' => now()->addYear(), 'monthly_rent' => 9000, 'status' => 'active']);
        $sold = $this->listing($this->agent, 'sold', 'for_sale');

        $this->actingAs($this->agent)->delete("/agent/listings/{$leased->id}")->assertSessionHas('error', fn ($m) => str_contains($m, 'current lease'));
        $this->actingAs($this->agent)->delete("/agent/listings/{$sold->id}")->assertSessionHas('error', fn ($m) => str_contains($m, 'commission records'));
        $this->assertNotSoftDeleted('listings', ['id' => $leased->id]);
        $this->assertNotSoftDeleted('listings', ['id' => $sold->id]);
    }
}
