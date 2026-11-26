<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\PersonalAccessToken;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Mobile API (/api/v1) — Sanctum token auth lifecycle and route protection.
 */
class ApiV1AuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    private function makeUser(Role $role = Role::Tenant, UserStatus $status = UserStatus::Active): User
    {
        $user = User::factory()->create([
            'password' => Hash::make('secret-password'),
            'role'     => $role,
            'status'   => $status,
        ]);
        $user->assignRole($role->value);

        return $user;
    }

    #[Test]
    public function login_returns_token_and_user_with_roles(): void
    {
        $user = $this->makeUser();

        $res = $this->postJson('/api/v1/auth/login', [
            'email'       => $user->email,
            'password'    => 'secret-password',
            'device_name' => 'pixel-9',
        ]);

        $res->assertCreated()
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email', 'roles', 'initials']])
            ->assertJsonPath('user.roles.0', 'tenant');

        $this->assertDatabaseHas('personal_access_tokens', [
            'tokenable_id'   => $user->id,
            'tokenable_type' => User::class,
            'name'           => 'pixel-9',
        ]);
        // Plaintext token is never stored — Sanctum persists a sha256 hash of
        // the part after the "id|" prefix.
        $this->assertNotEquals($res->json('token'), PersonalAccessToken::first()->token);
    }

    #[Test]
    public function login_rejects_bad_credentials(): void
    {
        $user = $this->makeUser();

        $this->postJson('/api/v1/auth/login', [
            'email'    => $user->email,
            'password' => 'wrong',
        ])->assertUnprocessable();
    }

    #[Test]
    public function login_rejects_inactive_accounts(): void
    {
        $user = $this->makeUser(status: UserStatus::Pending);

        $this->postJson('/api/v1/auth/login', [
            'email'    => $user->email,
            'password' => 'secret-password',
        ])->assertUnprocessable();
    }

    #[Test]
    public function protected_routes_require_a_valid_token(): void
    {
        $this->getJson('/api/v1/me')->assertUnauthorized();
        $this->getJson('/api/v1/me', ['Authorization' => 'Bearer 999|not-a-real-token'])
            ->assertUnauthorized();
    }

    #[Test]
    public function me_returns_the_token_owner(): void
    {
        $user  = $this->makeUser();
        $token = $user->createToken('phone')->plainTextToken;

        $this->getJson('/api/v1/me', ['Authorization' => "Bearer {$token}"])
            ->assertOk()
            ->assertJsonPath('user.id', $user->id);
    }

    #[Test]
    public function suspended_user_with_a_live_token_is_rejected(): void
    {
        $user  = $this->makeUser();
        $token = $user->createToken('phone')->plainTextToken;

        // Token stays valid, but the account is suspended after issue.
        $user->forceFill(['status' => UserStatus::Suspended])->save();

        $this->getJson('/api/v1/me', ['Authorization' => "Bearer {$token}"])
            ->assertForbidden();
    }

    #[Test]
    public function logout_revokes_only_the_current_token(): void
    {
        $user   = $this->makeUser();
        $phone  = $user->createToken('phone')->plainTextToken;
        $tablet = $user->createToken('tablet')->plainTextToken;

        $this->postJson('/api/v1/auth/logout', [], ['Authorization' => "Bearer {$phone}"])
            ->assertOk();

        // Feature tests share one container across sub-requests, so the auth
        // singleton caches the user resolved during logout. Reset it to
        // reproduce a real request boundary (fresh FPM/Octane process), where
        // the now-deleted token is re-looked-up and rejected.
        $this->app['auth']->forgetGuards();

        $this->getJson('/api/v1/me', ['Authorization' => "Bearer {$phone}"])->assertUnauthorized();
        $this->getJson('/api/v1/me', ['Authorization' => "Bearer {$tablet}"])->assertOk();
    }

    #[Test]
    public function tenant_token_cannot_access_agent_endpoints(): void
    {
        $user  = $this->makeUser(Role::Tenant);
        $token = $user->createToken('phone')->plainTextToken;

        // ResolvesAgent aborts 403 for users without an AgencyAgent pivot.
        $this->getJson('/api/v1/agent/overview', ['Authorization' => "Bearer {$token}"])
            ->assertForbidden();
    }
}
