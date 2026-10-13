<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Landlord;
use App\Models\Lease;
use App\Models\Listing;
use App\Models\RentPayment;
use App\Models\User;
use App\Services\LeaseBillingService;
use Carbon\CarbonImmutable;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** Contractual late-payment penalties, set per lease by the landlord. */
class LateFeeTest extends TestCase
{
    use RefreshDatabase;

    private User $landlordUser;
    private User $tenant;
    private Lease $lease;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        // The 15th of the month: past a "pay by the 10th" cut-off.
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-15 09:00'));
        \Illuminate\Support\Carbon::setTestNow(CarbonImmutable::parse('2026-10-15 09:00'));

        $this->landlordUser = User::factory()->create(['role' => Role::Landlord, 'status' => UserStatus::Active]);
        $this->landlordUser->assignRole('landlord');
        $landlord = Landlord::create(['user_id' => $this->landlordUser->id]);
        $landlord->activateSubscription('promo', now()->addYear());

        $this->tenant = User::factory()->create(['role' => Role::Tenant, 'status' => UserStatus::Active]);
        $listing = Listing::create([
            'ulid' => (string) Str::ulid(), 'owner_type' => Landlord::class, 'owner_id' => $landlord->id,
            'title' => '45 Test Street', 'slug' => 'test-' . Str::random(8), 'listing_type' => 'long_term_rent',
            'property_type' => 'house', 'status' => 'leased',
        ]);
        $this->lease = Lease::create([
            'listing_id' => $listing->id, 'tenant_id' => $this->tenant->id, 'landlord_id' => $this->landlordUser->id,
            'start_date' => '2026-08-01', 'end_date' => '2027-07-31',
            'monthly_rent' => 4000, 'deposit_amount' => 4000, 'status' => 'active',
        ]);
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        \Illuminate\Support\Carbon::setTestNow();
        parent::tearDown();
    }

    private function enable(array $overrides = []): void
    {
        $this->lease->update(array_merge([
            'late_fee_enabled' => true, 'late_fee_type' => 'percent', 'late_fee_value' => 10,
            'late_fee_day' => 10, 'late_fee_since' => '2026-09-01',
        ], $overrides));
    }

    private function charge(string $period): RentPayment
    {
        return RentPayment::where('lease_id', $this->lease->id)->where('period_month', $period)->firstOrFail();
    }

    #[Test]
    public function no_penalty_unless_the_landlord_switches_it_on(): void
    {
        app(LeaseBillingService::class)->ensureCharges($this->lease);

        $this->assertSame(0.0, (float) $this->charge('2026-10')->late_fee);
        $this->assertSame(4000.0, (float) $this->charge('2026-10')->amount);
    }

    #[Test]
    public function unpaid_rent_after_the_cutoff_gets_the_percentage_penalty_once(): void
    {
        $this->enable();
        $billing = app(LeaseBillingService::class);
        $billing->ensureCharges($this->lease);
        $billing->ensureCharges($this->lease); // idempotent

        $oct = $this->charge('2026-10');
        $this->assertSame(400.0, (float) $oct->late_fee);
        $this->assertSame(4400.0, (float) $oct->amount);
        $this->assertSame(4400.0, (float) $this->charge('2026-09')->amount);

        // August's cut-off passed before penalties were switched on: never back-charged.
        $this->assertSame(4000.0, (float) $this->charge('2026-08')->amount);
    }

    #[Test]
    public function paid_months_and_months_before_the_cutoff_are_not_penalised(): void
    {
        $this->enable(['late_fee_day' => 20, 'late_fee_type' => 'fixed', 'late_fee_value' => 250]);
        $billing = app(LeaseBillingService::class);
        $billing->ensureCharges($this->lease);
        RentPayment::where('lease_id', $this->lease->id)->where('period_month', '2026-09')->update(['status' => 'paid', 'paid_at' => now()]);

        $this->assertSame(0.0, (float) $this->charge('2026-10')->late_fee); // cut-off is the 20th, today is the 15th

        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-21 09:00'));
        \Illuminate\Support\Carbon::setTestNow(CarbonImmutable::parse('2026-10-21 09:00'));
        $billing->ensureCharges($this->lease);

        $this->assertSame(4250.0, (float) $this->charge('2026-10')->amount);
    }

    #[Test]
    public function landlord_sets_penalty_per_property_from_settings(): void
    {
        $this->actingAs($this->landlordUser)
            ->patch("/landlord/settings/penalties/{$this->lease->id}", ['enabled' => true, 'type' => 'percent', 'value' => 10, 'day' => 10])
            ->assertRedirect();

        $lease = $this->lease->fresh();
        $this->assertTrue($lease->late_fee_enabled);
        $this->assertSame('2026-10-15', $lease->late_fee_since->toDateString());
        $this->assertSame('10% of rent if not paid by the 10th', $lease->lateFeeSummary());

        // Switched on after this month's cut-off: nothing is back-charged.
        $this->assertSame(0, RentPayment::where('lease_id', $lease->id)->where('late_fee', '>', 0)->count());

        $this->actingAs($this->landlordUser)->get('/landlord/settings')
            ->assertOk()
            ->assertInertia(fn (Assert $p) => $p
                ->has('penalties', 1)
                ->where('penalties.0.enabled', true)
                ->where('penalties.0.day', 10)
            );
    }

    #[Test]
    public function landlord_can_waive_an_unpaid_penalty(): void
    {
        $this->enable();
        app(LeaseBillingService::class)->ensureCharges($this->lease);
        $oct = $this->charge('2026-10');

        $this->actingAs($this->landlordUser)
            ->post("/landlord/settings/penalties/charges/{$oct->id}/waive")
            ->assertRedirect();

        $oct->refresh();
        $this->assertSame(0.0, (float) $oct->late_fee);
        $this->assertSame(4000.0, (float) $oct->amount);
        $this->assertNotNull($oct->late_fee_waived_at);

        // A waived month is not penalised again on the next run.
        app(LeaseBillingService::class)->ensureCharges($this->lease);
        $this->assertSame(4000.0, (float) $oct->fresh()->amount);
    }

    #[Test]
    public function another_landlord_cannot_change_or_waive_penalties(): void
    {
        $this->enable();
        app(LeaseBillingService::class)->ensureCharges($this->lease);

        $other = User::factory()->create(['role' => Role::Landlord, 'status' => UserStatus::Active]);
        $other->assignRole('landlord');
        Landlord::create(['user_id' => $other->id])->activateSubscription('promo', now()->addYear());

        $this->actingAs($other)
            ->patch("/landlord/settings/penalties/{$this->lease->id}", ['enabled' => false, 'type' => 'percent', 'value' => 0, 'day' => 7])
            ->assertForbidden();
        $this->actingAs($other)
            ->post("/landlord/settings/penalties/charges/{$this->charge('2026-10')->id}/waive")
            ->assertForbidden();
    }

    #[Test]
    public function tenant_sees_the_penalty_on_payments(): void
    {
        $this->enable();

        $this->actingAs($this->tenant)->get('/tenant/payments')
            ->assertOk()
            ->assertInertia(fn (Assert $p) => $p
                ->where('lease.late_fee', '10% of rent if not paid by the 10th')
                ->where('upcoming.0.late_fee', 0) // August: cut-off before penalties were on
                ->where('upcoming.1.late_fee', 400)
                ->where('upcoming.1.amount', 4400)
            );
    }
}
