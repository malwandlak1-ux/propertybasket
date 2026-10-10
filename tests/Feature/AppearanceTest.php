<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Http\Middleware\HandleInertiaRequests;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Settings → Appearance: accent colour + dashboard logo (all roles), and the
 * `appearance` Inertia shared prop that the dashboard Shell reads.
 */
class AppearanceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        Storage::fake('public');
    }

    private function user(Role $role = Role::Tenant): User
    {
        return User::factory()->create(['role' => $role, 'status' => UserStatus::Active]);
    }

    private function appearanceFor(User $user): array
    {
        $request = Request::create('/');
        $request->setUserResolver(fn () => $user);
        $shared = app(HandleInertiaRequests::class)->share($request);

        return ($shared['appearance'])();
    }

    #[Test]
    public function accent_defaults_to_orange(): void
    {
        $this->assertSame('orange', $this->appearanceFor($this->user())['accent']);
    }

    #[Test]
    public function user_can_change_accent(): void
    {
        $user = $this->user();

        $this->actingAs($user)->post('/settings/appearance', ['accent' => 'blue'])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $this->assertSame('blue', $user->fresh()->theme_accent);
        $this->assertSame('blue', $this->appearanceFor($user->fresh())['accent']);
    }

    #[Test]
    public function unknown_accent_is_rejected(): void
    {
        $user = $this->user();

        $this->actingAs($user)->post('/settings/appearance', ['accent' => 'hotpink'])
            ->assertSessionHasErrors('accent');

        $this->assertNull($user->fresh()->theme_accent);
    }

    #[Test]
    public function guests_cannot_change_appearance(): void
    {
        $this->post('/settings/appearance', ['accent' => 'green'])->assertRedirect('/login');
    }

    #[Test]
    public function user_can_upload_replace_and_remove_logo(): void
    {
        $user = $this->user(Role::Landlord);

        $this->actingAs($user)->post('/settings/logo', ['logo' => UploadedFile::fake()->image('logo.png', 400, 120)])
            ->assertSessionHasNoErrors();

        $first = $user->fresh()->dashboard_logo;
        $this->assertNotNull($first);
        Storage::disk('public')->assertExists($first);
        $this->assertSame('/storage/' . $first, $this->appearanceFor($user->fresh())['logo_url']);

        // Replacing deletes the previous file.
        $this->actingAs($user)->post('/settings/logo', ['logo' => UploadedFile::fake()->image('logo2.jpg', 400, 120)]);
        $second = $user->fresh()->dashboard_logo;
        $this->assertNotSame($first, $second);
        Storage::disk('public')->assertMissing($first);

        $this->actingAs($user)->delete('/settings/logo')->assertSessionHasNoErrors();
        $this->assertNull($user->fresh()->dashboard_logo);
        Storage::disk('public')->assertMissing($second);
        $this->assertNull($this->appearanceFor($user->fresh())['logo_url']);
    }

    #[Test]
    public function logo_must_be_a_raster_image(): void
    {
        $user = $this->user();

        $this->actingAs($user)->post('/settings/logo', [
            'logo' => UploadedFile::fake()->create('logo.svg', 4, 'image/svg+xml'),
        ])->assertSessionHasErrors('logo');

        $this->assertNull($user->fresh()->dashboard_logo);
    }

    #[Test]
    public function agent_inherits_agency_owner_logo_until_they_upload_their_own(): void
    {
        $owner = $this->user(Role::AgencyAdmin);
        $agent = $this->user(Role::Agent);

        $agency = Agency::create([
            'user_id' => $owner->id,
            'name'    => 'Test Agency',
            'slug'    => 'test-agency-' . Str::random(6),
            'email'   => $owner->email,
            'status'  => 'active',
        ]);
        AgencyAgent::create([
            'agency_id'                => $agency->id,
            'user_id'                  => $agent->id,
            'commission_split_percent' => 50,
            'lead_allocation_position' => 0,
            'ffc_expires_at'           => CarbonImmutable::now()->addYear(),
            'status'                   => 'active',
        ]);

        $owner->forceFill(['dashboard_logo' => 'logos/agency.png'])->save();

        $shared = $this->appearanceFor($agent);
        $this->assertSame('/storage/logos/agency.png', $shared['logo_url']);
        $this->assertTrue($shared['logo_inherited']);
        $this->assertFalse($shared['has_own_logo']);

        $agent->forceFill(['dashboard_logo' => 'logos/mine.png'])->save();
        $shared = $this->appearanceFor($agent->fresh());
        $this->assertSame('/storage/logos/mine.png', $shared['logo_url']);
        $this->assertFalse($shared['logo_inherited']);
    }
}
