<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\Contractor;
use App\Models\Invitation;
use App\Models\Landlord;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    // ── Login ────────────────────────────────────────────────────────────

    #[Test]
    public function login_page_renders_for_guests(): void
    {
        $this->get('/login')->assertOk();
    }

    #[Test]
    public function user_can_log_in_with_valid_credentials(): void
    {
        $user = User::factory()->create([
            'email'    => 'jane@example.test',
            'password' => Hash::make('secret-password'),
            'role'     => Role::Agent,
            'status'   => UserStatus::Active,
        ]);

        $this->post('/login', [
            'email'    => 'jane@example.test',
            'password' => 'secret-password',
        ])
            ->assertRedirect('/dashboard');

        $this->assertAuthenticatedAs($user);
        $this->assertNotNull($user->fresh()->last_active_at);
    }

    #[Test]
    public function login_fails_for_wrong_password(): void
    {
        User::factory()->create([
            'email'    => 'jane@example.test',
            'password' => Hash::make('correct-password'),
            'role'     => Role::Agent,
            'status'   => UserStatus::Active,
        ]);

        $this->from('/login')->post('/login', [
            'email'    => 'jane@example.test',
            'password' => 'WRONG',
        ])
            ->assertRedirect('/login')
            ->assertSessionHasErrors('email');

        $this->assertGuest();
    }

    #[Test]
    public function login_fails_for_unknown_email(): void
    {
        $this->from('/login')->post('/login', [
            'email'    => 'nobody@example.test',
            'password' => 'anything',
        ])
            ->assertRedirect('/login')
            ->assertSessionHasErrors('email');

        $this->assertGuest();
    }

    #[Test]
    public function logout_invalidates_the_session(): void
    {
        $user = User::factory()->create(['role' => Role::Agent, 'status' => UserStatus::Active]);

        $this->actingAs($user)
            ->post('/logout')
            ->assertRedirect('/');

        $this->assertGuest();
    }

    // ── Dashboard dispatch by role ──────────────────────────────────────

    #[Test]
    public function dashboard_redirects_each_role_to_its_own_dashboard(): void
    {
        $cases = [
            [Role::SuperAdmin,  '/admin'],
            [Role::AgencyAdmin, '/agency'],
            [Role::Agent,       '/agent'],
            [Role::Landlord,    '/landlord'],
            [Role::Tenant,      '/tenant'],
            [Role::Contractor,  '/contractor'],
        ];

        foreach ($cases as [$role, $expectedPath]) {
            $user = User::factory()->create(['role' => $role, 'status' => UserStatus::Active]);
            $this->actingAs($user)
                ->get('/dashboard')
                ->assertRedirect($expectedPath);
        }
    }

    // ── Registration ─────────────────────────────────────────────────────

    #[Test]
    public function register_page_renders_for_guests(): void
    {
        $this->get('/register')->assertOk();
    }

    #[Test]
    public function landlord_can_register_themselves(): void
    {
        $this->post('/register', [
            'role'                  => 'landlord',
            'name'                  => 'Lerato Khumalo',
            'email'                 => 'lerato@example.test',
            'phone'                 => '+27 82 555 0001',
            'password'              => 'longpassword123',
            'password_confirmation' => 'longpassword123',
            'terms_accepted'        => true,
        ])
            ->assertRedirect('/dashboard');

        $user = User::where('email', 'lerato@example.test')->first();
        $this->assertNotNull($user);
        $this->assertEquals(Role::Landlord, $user->role);
        $this->assertEquals(UserStatus::Pending, $user->status);
        $this->assertTrue($user->hasRole(Role::Landlord->value));
        $this->assertDatabaseHas('landlords', ['user_id' => $user->id]);
        $this->assertAuthenticatedAs($user);
    }

    #[Test]
    public function agency_registration_creates_pending_agency_record(): void
    {
        $this->post('/register', [
            'role'                  => 'agency',
            'name'                  => 'Sandile Mthembu',
            'email'                 => 'sandile@khaya.test',
            'password'              => 'longpassword123',
            'password_confirmation' => 'longpassword123',
            'business_name'         => 'Khaya Realty',
            'compliance_number'     => 'FFC-2026-KH-001',
            'terms_accepted'        => true,
        ])
            ->assertRedirect('/dashboard');

        $user = User::where('email', 'sandile@khaya.test')->first();
        $this->assertEquals(Role::AgencyAdmin, $user->role);

        $agency = Agency::where('user_id', $user->id)->first();
        $this->assertNotNull($agency);
        $this->assertEquals('Khaya Realty', $agency->name);
        $this->assertEquals('FFC-2026-KH-001', $agency->eaab_ffc_number);
        $this->assertEquals('pending', $agency->status);
    }

    #[Test]
    public function contractor_registration_creates_contractor_record(): void
    {
        $this->post('/register', [
            'role'                  => 'contractor',
            'name'                  => 'Themba Mokoena',
            'email'                 => 'themba@plumbpro.test',
            'password'              => 'longpassword123',
            'password_confirmation' => 'longpassword123',
            'business_name'         => 'PlumbPro Solutions',
            'compliance_number'     => '2023/445566/07',
            'terms_accepted'        => true,
        ])
            ->assertRedirect('/dashboard');

        $user = User::where('email', 'themba@plumbpro.test')->firstOrFail();
        $contractor = Contractor::where('user_id', $user->id)->firstOrFail();

        $this->assertEquals('PlumbPro Solutions', $contractor->business_name);
        $this->assertEquals('2023/445566/07', $contractor->cipc_number);
        $this->assertEquals('pending', $contractor->status);
    }

    #[Test]
    public function registration_validates_required_fields(): void
    {
        $this->from('/register')->post('/register', [])
            ->assertSessionHasErrors(['role', 'name', 'email', 'password', 'terms_accepted']);
    }

    #[Test]
    public function registration_rejects_duplicate_email(): void
    {
        User::factory()->create(['email' => 'taken@example.test', 'role' => Role::Tenant]);

        $this->from('/register')->post('/register', [
            'role'                  => 'landlord',
            'name'                  => 'X',
            'email'                 => 'taken@example.test',
            'password'              => 'longpassword123',
            'password_confirmation' => 'longpassword123',
            'terms_accepted'        => true,
        ])
            ->assertSessionHasErrors('email');
    }

    #[Test]
    public function registration_requires_password_confirmation(): void
    {
        $this->from('/register')->post('/register', [
            'role'                  => 'landlord',
            'name'                  => 'X',
            'email'                 => 'x@example.test',
            'password'              => 'longpassword123',
            'password_confirmation' => 'different',
            'terms_accepted'        => true,
        ])
            ->assertSessionHasErrors('password');
    }

    #[Test]
    public function registration_requires_terms_to_be_accepted(): void
    {
        $this->from('/register')->post('/register', [
            'role'                  => 'landlord',
            'name'                  => 'X',
            'email'                 => 'x@example.test',
            'password'              => 'longpassword123',
            'password_confirmation' => 'longpassword123',
        ])
            ->assertSessionHasErrors('terms_accepted');
    }

    // ── Invitation acceptance ────────────────────────────────────────────

    #[Test]
    public function valid_invitation_page_renders(): void
    {
        $inviter = User::factory()->create(['role' => Role::AgencyAdmin]);
        $invite  = Invitation::create([
            'email'      => 'invitee@example.test',
            'role'       => Role::Agent->value,
            'invited_by' => $inviter->id,
            'token'      => Str::random(40),
            'expires_at' => now()->addDays(7),
        ]);

        $this->get("/invite/{$invite->token}")->assertOk();
    }

    #[Test]
    public function invitee_can_complete_signup(): void
    {
        $inviter = User::factory()->create(['role' => Role::AgencyAdmin]);
        $invite  = Invitation::create([
            'email'      => 'invitee@example.test',
            'role'       => Role::Agent->value,
            'invited_by' => $inviter->id,
            'token'      => Str::random(40),
            'expires_at' => now()->addDays(7),
        ]);

        $this->post("/invite/{$invite->token}", [
            'name'                  => 'Invited Agent',
            'password'              => 'longpassword123',
            'password_confirmation' => 'longpassword123',
            'terms_accepted'        => true,
        ])
            ->assertRedirect('/dashboard');

        $user = User::where('email', 'invitee@example.test')->firstOrFail();
        $this->assertEquals(Role::Agent, $user->role);
        $this->assertEquals(UserStatus::Active, $user->status);
        $this->assertEquals($inviter->id, $user->invited_by);
        $this->assertNotNull($user->invite_accepted_at);
        $this->assertNotNull($user->email_verified_at);
        $this->assertTrue($user->hasRole(Role::Agent->value));

        $this->assertNotNull($invite->fresh()->accepted_at);
        $this->assertAuthenticatedAs($user);
    }

    #[Test]
    public function expired_invitation_returns_410(): void
    {
        $invite = Invitation::create([
            'email'      => 'old@example.test',
            'role'       => Role::Agent->value,
            'invited_by' => User::factory()->create(['role' => Role::AgencyAdmin])->id,
            'token'      => Str::random(40),
            'expires_at' => now()->subDay(),
        ]);

        $this->get("/invite/{$invite->token}")->assertStatus(410);
    }

    #[Test]
    public function already_accepted_invitation_returns_410(): void
    {
        $invite = Invitation::create([
            'email'       => 'used@example.test',
            'role'        => Role::Agent->value,
            'invited_by'  => User::factory()->create(['role' => Role::AgencyAdmin])->id,
            'token'       => Str::random(40),
            'expires_at'  => now()->addDays(7),
            'accepted_at' => now(),
        ]);

        $this->get("/invite/{$invite->token}")->assertStatus(410);
    }

    #[Test]
    public function unknown_invitation_token_returns_404(): void
    {
        $this->get('/invite/this-token-does-not-exist')->assertStatus(404);
    }
}
