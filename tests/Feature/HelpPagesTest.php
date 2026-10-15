<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\Contractor;
use App\Models\Landlord;
use App\Models\Lease;
use App\Models\Listing;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** Help & Support pages for every role's dashboard. */
class HelpPagesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    #[Test]
    public function each_role_has_a_help_page(): void
    {
        config(['edition.support_email' => 'support@example.test']);

        $landlordUser = User::factory()->create(['role' => Role::Landlord, 'status' => UserStatus::Active, 'name' => 'Careline Clinic']);
        $landlordUser->assignRole('landlord');
        $landlord = Landlord::create(['user_id' => $landlordUser->id]);
        $landlord->activateSubscription('promo', now()->addYear());
        $this->actingAs($landlordUser)->get('/landlord/help')->assertOk()
            ->assertInertia(fn (Assert $p) => $p->component('Landlord/Help')->where('support_email', 'support@example.test'));

        $tenant = User::factory()->create(['role' => Role::Tenant, 'status' => UserStatus::Active]);
        $listing = Listing::create([
            'ulid' => (string) Str::ulid(), 'owner_type' => Landlord::class, 'owner_id' => $landlord->id,
            'title' => '45 Test Street', 'address' => '45 Test Street', 'slug' => 'test-' . Str::random(8),
            'listing_type' => 'long_term_rent', 'property_type' => 'house', 'status' => 'leased',
        ]);
        Lease::create([
            'listing_id' => $listing->id, 'tenant_id' => $tenant->id, 'landlord_id' => $landlordUser->id,
            'start_date' => now()->startOfMonth(), 'end_date' => now()->addYear(), 'monthly_rent' => 3000, 'status' => 'active',
        ]);
        $this->actingAs($tenant)->get('/tenant/help')->assertOk()
            ->assertInertia(fn (Assert $p) => $p->component('Tenant/Help')
                ->where('managed_by', 'Careline Clinic')
                ->where('lease.address', '45 Test Street'));

        $contractorUser = User::factory()->create(['role' => Role::Contractor, 'status' => UserStatus::Active]);
        $contractorUser->assignRole('contractor');
        Contractor::create(['user_id' => $contractorUser->id, 'business_name' => 'Fix-It', 'status' => 'active']);
        $this->actingAs($contractorUser)->get('/contractor/help')->assertOk()
            ->assertInertia(fn (Assert $p) => $p->component('Contractor/Help'));

        // Not across roles.
        $this->actingAs($tenant)->get('/landlord/help')->assertForbidden();
    }

    #[Test]
    public function agency_agent_and_admin_have_help_pages(): void
    {
        config(['edition.support_email' => 'support@example.test']);

        $owner = User::factory()->create(['role' => Role::AgencyAdmin, 'status' => UserStatus::Active]);
        $owner->assignRole('agency_admin');
        $agency = Agency::create([
            'user_id' => $owner->id, 'name' => 'Sandton Realty', 'slug' => 'sandton-' . Str::random(6),
            'email' => $owner->email, 'status' => 'active',
        ]);
        $agency->activateSubscription('promo', now()->addYear());
        $this->actingAs($owner)->get('/agency/help')->assertOk()
            ->assertInertia(fn (Assert $p) => $p->component('Agency/Help')
                ->where('agency_name', 'Sandton Realty')
                ->where('support_email', 'support@example.test'));

        $agent = User::factory()->create(['role' => Role::Agent, 'status' => UserStatus::Active]);
        $agent->assignRole('agent');
        AgencyAgent::create([
            'agency_id' => $agency->id, 'user_id' => $agent->id, 'commission_split_percent' => 50,
            'lead_allocation_position' => 0, 'ffc_expires_at' => now()->addYear(), 'status' => 'active',
        ]);
        $this->actingAs($agent)->get('/agent/help')->assertOk()
            ->assertInertia(fn (Assert $p) => $p->component('Agent/Help')->where('agency_name', 'Sandton Realty'));

        $admin = User::factory()->create(['role' => Role::SuperAdmin, 'status' => UserStatus::Active]);
        $admin->assignRole('super_admin');
        $this->actingAs($admin)->get('/admin/help')->assertOk()
            ->assertInertia(fn (Assert $p) => $p->component('Admin/Help'));

        // Not across roles.
        $this->actingAs($agent)->get('/admin/help')->assertForbidden();
    }

    #[Test]
    public function a_no_reply_address_is_never_offered_as_support(): void
    {
        config(['edition.support_email' => null, 'mail.from.address' => 'no-reply@example.test']);

        $user = User::factory()->create(['role' => Role::Landlord, 'status' => UserStatus::Active]);
        $user->assignRole('landlord');
        Landlord::create(['user_id' => $user->id])->activateSubscription('promo', now()->addYear());

        $this->actingAs($user)->get('/landlord/help')
            ->assertInertia(fn (Assert $p) => $p->where('support_email', null));
    }
}
