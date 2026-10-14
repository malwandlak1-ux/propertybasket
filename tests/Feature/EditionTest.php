<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** DISABLED_ROLES site switch (careline runs without agencies/agents). */
class EditionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    private function careline(): void
    {
        config(['edition.disabled_roles' => ['agency_admin', 'agent']]);
    }

    private function user(Role $role): User
    {
        return User::factory()->create(['role' => $role, 'status' => UserStatus::Active]);
    }

    #[Test]
    public function every_role_is_enabled_by_default(): void
    {
        $this->get('/register')->assertInertia(fn (Assert $p) => $p
            ->where('roles', ['agency', 'landlord', 'contractor'])
            ->where('edition.disabled_roles', [])
        );
        $this->get('/agencies')->assertOk();
    }

    #[Test]
    public function disabled_roles_lose_their_routes(): void
    {
        $this->careline();

        $this->get('/agencies')->assertNotFound();
        $this->actingAs($this->user(Role::Agent))->get('/agent')->assertNotFound();
        $this->actingAs($this->user(Role::AgencyAdmin))->get('/agency')->assertNotFound();
        $this->actingAs($this->user(Role::SuperAdmin))->get('/admin/agencies')->assertNotFound();
    }

    #[Test]
    public function enabled_dashboards_still_resolve(): void
    {
        $this->careline();

        $this->actingAs($this->user(Role::Tenant))->get('/dashboard')->assertRedirect(route('tenant.overview'));
        $this->actingAs($this->user(Role::Contractor))->get('/dashboard')->assertRedirect(route('contractor.overview'));
        $this->actingAs($this->user(Role::SuperAdmin))->get('/dashboard')->assertRedirect(route('admin.overview'));
    }

    #[Test]
    public function disabled_role_user_is_signed_out_at_dashboard(): void
    {
        $this->careline();

        $this->actingAs($this->user(Role::Agent))->get('/dashboard')
            ->assertRedirect(route('login'))
            ->assertSessionHasErrors('email');
        $this->assertGuest();
    }

    #[Test]
    public function without_public_site_portal_pages_go_to_login(): void
    {
        config(['edition.public_site' => false]);

        $this->get('/')->assertRedirect(route('login'));
        $this->get('/properties')->assertRedirect(route('login'));
        $this->get('/calculator')->assertRedirect(route('login'));
        $this->post('/inquiries', [])->assertNotFound();

        // Login + legal pages still work; signed-in users land on their dashboard.
        $this->get('/login')->assertOk();
        $this->get('/privacy-policy')->assertOk();
        $this->actingAs($this->user(Role::Tenant))->get('/')->assertRedirect(route('dashboard'));
    }

    #[Test]
    public function public_site_is_on_by_default(): void
    {
        $this->get('/')->assertOk();
    }

    #[Test]
    public function signup_drops_the_agency_option(): void
    {
        $this->careline();

        $this->get('/register')->assertInertia(fn (Assert $p) => $p
            ->where('roles', ['landlord', 'contractor'])
            ->where('edition.disabled_roles', ['agency_admin', 'agent'])
        );

        $this->post('/register', [
            'role' => 'agency', 'name' => 'X', 'email' => 'x@example.test',
            'password' => 'password123', 'password_confirmation' => 'password123',
            'business_name' => 'X Realty', 'compliance_number' => '123', 'terms_accepted' => true,
        ])->assertSessionHasErrors('role');

        $this->assertDatabaseMissing('users', ['email' => 'x@example.test']);
    }

    #[Test]
    public function brand_defaults_to_property_basket(): void
    {
        $this->get('/login')->assertOk()
            ->assertSee('<title inertia>Property Basket</title>', false)
            ->assertInertia(fn (Assert $p) => $p
                ->where('edition.brand.name', 'Property Basket')
                ->where('edition.brand.custom', false)
            );
    }

    #[Test]
    public function client_site_shares_its_own_brand(): void
    {
        config(['edition.brand' => [
            'name' => 'Careline Clinic', 'logo' => '/images/brands/careline-clinic.png',
            'icon' => '/images/brands/careline-clinic-icon.png', 'color' => '#2E8FA8', 'color_alt' => '#8DC63F',
        ]]);

        $this->get('/login')->assertOk()
            ->assertSee('<title inertia>Careline Clinic</title>', false)
            ->assertSee('/images/brands/careline-clinic-icon.png', false)
            ->assertInertia(fn (Assert $p) => $p
                ->where('edition.brand.name', 'Careline Clinic')
                ->where('edition.brand.logo', '/images/brands/careline-clinic.png')
                ->where('edition.brand.custom', true)
            );
        $this->assertFileExists(public_path('images/brands/careline-clinic.png'));
    }

    #[Test]
    public function site_accent_is_the_default_but_a_users_own_choice_wins(): void
    {
        config(['edition.brand.accent' => 'teal']);

        $user = User::factory()->create(['role' => Role::Landlord, 'status' => UserStatus::Active]);
        $user->assignRole('landlord');
        \App\Models\Landlord::create(['user_id' => $user->id])->activateSubscription('promo', now()->addYear());

        $this->actingAs($user)->get('/landlord/settings')
            ->assertInertia(fn (Assert $p) => $p->where('appearance.accent', 'teal'));

        $this->actingAs($user)->post('/settings/appearance', ['accent' => 'purple'])->assertRedirect();
        $this->actingAs($user)->get('/landlord/settings')
            ->assertInertia(fn (Assert $p) => $p->where('appearance.accent', 'purple'));

        $this->actingAs($user)->post('/settings/appearance', ['accent' => 'teal'])->assertRedirect();
        $this->assertSame('teal', $user->fresh()->theme_accent);
    }
}
