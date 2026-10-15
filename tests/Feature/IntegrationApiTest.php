<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\ApiKey;
use App\Models\Landlord;
use App\Models\Lease;
use App\Models\Listing;
use App\Models\RentPayment;
use App\Models\User;
use App\Services\LeaseBillingService;
use Carbon\CarbonImmutable;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** Integration API v1: another system pulls a landlord's statements with an API key. */
class IntegrationApiTest extends TestCase
{
    use RefreshDatabase;

    private const BASE = '/api/integration/v1';

    private User $owner;
    private Landlord $landlord;
    private Listing $house;
    private Lease $lease;
    private string $key;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        CarbonImmutable::setTestNow('2026-10-15 09:00');
        Carbon::setTestNow('2026-10-15 09:00');

        [$this->owner, $this->landlord, $this->house] = $this->landlordWithProperty('45 MacDougall Street', 'Careline Clinic');
        $tenant = User::factory()->create(['role' => Role::Tenant, 'status' => UserStatus::Active, 'name' => 'Vhonani Maboga']);
        $this->lease = Lease::create([
            'listing_id' => $this->house->id, 'tenant_id' => $tenant->id, 'landlord_id' => $this->owner->id,
            'start_date' => '2026-08-01', 'end_date' => '2027-07-31', 'monthly_rent' => 3000, 'deposit_amount' => 3000, 'status' => 'active',
        ]);
        app(LeaseBillingService::class)->ensureCharges($this->lease);
        // August and September paid, October not.
        RentPayment::where('lease_id', $this->lease->id)->whereIn('period_month', ['2026-08', '2026-09'])->get()
            ->each(fn ($p) => $p->update(['status' => 'paid', 'paid_at' => CarbonImmutable::parse($p->due_date)->setTime(10, 0), 'payment_method' => 'manual']));

        [, $this->key] = ApiKey::issue($this->landlord, 'Accounting sync', $this->owner->id);
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function landlordWithProperty(string $address, string $name = 'Other Landlord'): array
    {
        $user = User::factory()->create(['role' => Role::Landlord, 'status' => UserStatus::Active, 'name' => $name]);
        $user->assignRole('landlord');
        $landlord = Landlord::create(['user_id' => $user->id]);
        $landlord->activateSubscription('promo', now()->addYear());
        $listing = Listing::create([
            'ulid' => (string) Str::ulid(), 'owner_type' => Landlord::class, 'owner_id' => $landlord->id,
            'title' => $address, 'address' => $address, 'slug' => 'test-' . Str::random(8),
            'listing_type' => 'long_term_rent', 'property_type' => 'house', 'status' => 'leased', 'monthly_rent' => 3000,
        ]);

        return [$user, $landlord, $listing];
    }

    private function api(string $path, ?string $key = null): \Illuminate\Testing\TestResponse
    {
        return $this->withHeader('Authorization', 'Bearer ' . ($key ?? $this->key))->get(self::BASE . $path);
    }

    #[Test]
    public function requests_need_a_valid_active_key(): void
    {
        $this->get(self::BASE . '/properties')->assertStatus(401)->assertJson(['error' => 'unauthenticated']);
        $this->api('/properties', 'pbk_wrong')->assertStatus(401);

        // X-Api-Key header works too.
        $this->flushHeaders();
        $this->withHeader('X-Api-Key', $this->key)->get(self::BASE . '/properties')->assertOk();
        $this->flushHeaders();

        ApiKey::query()->update(['revoked_at' => now()]);
        $this->api('/properties')->assertStatus(401);
    }

    #[Test]
    public function the_key_only_sees_its_own_landlords_data(): void
    {
        [, $other, $otherHouse] = $this->landlordWithProperty('99 Other Road');
        $otherLease = Lease::create([
            'listing_id' => $otherHouse->id, 'tenant_id' => User::factory()->create(['role' => Role::Tenant])->id,
            'start_date' => '2026-08-01', 'end_date' => '2027-07-31', 'monthly_rent' => 100, 'status' => 'active',
        ]);

        $this->api('/properties')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', '45 MacDougall Street');
        $this->api('/leases')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.tenant.name', 'Vhonani Maboga')
            ->assertJsonPath('data.0.payment_reference', 'Vhonani Maboga Rental');

        $this->api("/statements/owner?property={$otherHouse->id}")->assertNotFound();
        $this->api("/leases/{$otherLease->id}/statement")->assertNotFound();
    }

    #[Test]
    public function owner_statement_matches_the_finance_figures(): void
    {
        $this->api('/statements/owner?range=12')->assertOk()
            ->assertJsonPath('data.currency', 'ZAR')
            ->assertJsonPath('data.totals.rent_income', 6000)
            ->assertJsonPath('data.totals.maintenance', 0)
            ->assertJsonPath('data.totals.net', 6000)
            ->assertJsonPath('data.period.from', '2025-11-01')
            ->assertJsonCount(2, 'data.lines')
            ->assertJsonPath('data.lines.0.date', '2026-08-01')
            ->assertJsonPath('data.lines.1.running_net', 6000);

        $this->api('/statements/owner?month=2026-09')->assertOk()->assertJsonPath('data.totals.rent_income', 3000);
        $this->api('/statements/owner?from=2026-09-01&to=2026-10-15')->assertOk()->assertJsonPath('data.totals.rent_income', 3000);
        $this->api("/statements/owner?property={$this->house->id}&range=lease")->assertOk()
            ->assertJsonPath('data.property', '45 MacDougall Street')
            ->assertJsonPath('data.period.from', '2026-08-01');

        $this->api('/statements/owner/monthly')->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.month', '2026-10')
            ->assertJsonPath('data.1.rent_income', 3000);

        // Bad filters are rejected with a JSON 422.
        $this->api('/statements/owner?range=7')->assertStatus(422)->assertJsonValidationErrors('range');
        $this->api('/statements/owner?month=Sept')->assertStatus(422);
        $this->api('/statements/owner?from=2026-10-01&to=2026-09-01')->assertStatus(422);
    }

    #[Test]
    public function tenant_statement_and_pdfs(): void
    {
        $this->api("/leases/{$this->lease->id}/statement")->assertOk()
            ->assertJsonPath('data.tenant.name', 'Vhonani Maboga')
            ->assertJsonPath('data.totals.charged', 9000)
            ->assertJsonPath('data.totals.paid', 6000)
            ->assertJsonPath('data.totals.closing_balance', 3000);

        $pdf = $this->api('/statements/owner.pdf?range=6');
        $pdf->assertOk();
        $this->assertSame('application/pdf', $pdf->headers->get('Content-Type'));

        $this->api("/leases/{$this->lease->id}/statement.pdf?month=2026-09")->assertOk();
    }

    #[Test]
    public function a_suspended_owner_locks_their_keys(): void
    {
        $this->owner->update(['status' => UserStatus::Suspended]);
        $this->api('/properties')->assertStatus(403);
    }

    #[Test]
    public function landlord_creates_and_revokes_keys_in_settings(): void
    {
        $this->actingAs($this->owner)->post('/landlord/settings/api-keys', ['name' => 'Sage'])->assertRedirect()->assertSessionHas('new_api_key');
        $plain = session('new_api_key');
        $this->assertStringStartsWith('pbk_', $plain);
        $this->assertDatabaseMissing('api_keys', ['key_hash' => $plain]);       // never stored in plain text
        $this->api('/properties', $plain)->assertOk();

        $this->actingAs($this->owner)->get('/landlord/settings')->assertInertia(fn (Assert $p) => $p
            ->has('api_keys', 2)
            ->where('api_keys.0.name', 'Sage')
            ->where('api_base_url', url('/api/integration/v1')));

        $key = ApiKey::where('name', 'Sage')->firstOrFail();
        $this->actingAs($this->owner)->delete("/landlord/settings/api-keys/{$key->id}")->assertRedirect();
        $this->api('/properties', $plain)->assertStatus(401);

        // Another landlord can't revoke this landlord's keys.
        [$otherUser] = $this->landlordWithProperty('1 Elsewhere');
        $mine = ApiKey::where('name', 'Accounting sync')->firstOrFail();
        $this->actingAs($otherUser)->delete("/landlord/settings/api-keys/{$mine->id}")->assertNotFound();
    }
}
