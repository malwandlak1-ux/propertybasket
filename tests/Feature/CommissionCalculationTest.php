<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\Commission;
use App\Models\Landlord;
use App\Models\Lease;
use App\Models\Listing;
use App\Models\User;
use App\Services\CommissionService;
use Carbon\CarbonImmutable;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class CommissionCalculationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    // ── Test fixtures ───────────────────────────────────────────────────

    private function buildScenario(
        bool $vatRegistered = false,
        float $vatRate = 15.0,
        float $splitPercent = 70.0,
        ?CarbonImmutable $ffcExpires = null,
        ?string $paystackCode = 'RCP_TEST_123',
    ): array {
        $owner = User::factory()->create(['role' => Role::AgencyAdmin]);
        $agency = Agency::create([
            'user_id'        => $owner->id,
            'name'           => 'Test Agency',
            'slug'           => 'test-agency-' . Str::random(6),
            'email'          => $owner->email,
            'status'         => 'active',
            'vat_registered' => $vatRegistered,
            'vat_rate'       => $vatRate,
        ]);

        $agent = User::factory()->create([
            'role'                    => Role::Agent,
            'status'                  => UserStatus::Active,
            'paystack_recipient_code' => $paystackCode,
        ]);

        AgencyAgent::create([
            'agency_id'                => $agency->id,
            'user_id'                  => $agent->id,
            'commission_split_percent' => $splitPercent,
            'lead_allocation_position' => 0,
            'ffc_expires_at'           => $ffcExpires ?? CarbonImmutable::now()->addYear(),
            'status'                   => 'active',
        ]);

        $listing = Listing::create([
            'ulid'          => (string) Str::ulid(),
            'owner_type'    => Agency::class,
            'owner_id'      => $agency->id,
            'agent_id'      => $agent->id,
            'title'         => 'Commission Test Listing',
            'slug'          => 'comm-' . Str::random(8),
            'description'   => 'Test listing',
            'listing_type'  => 'long_term_rent',
            'property_type' => 'apartment',
            'status'        => 'leased',
            'monthly_rent'  => 10_000,
            'sale_price'    => 2_000_000,
            'bedrooms'      => 2,
            'bathrooms'     => 1,
            'suburb'        => 'Sandton',
            'city'          => 'Johannesburg',
            'province'      => 'Gauteng',
        ]);

        $lease = Lease::create([
            'listing_id'           => $listing->id,
            'agency_id'            => $agency->id,
            'agent_id'             => $agent->id,
            'tenant_id'            => User::factory()->create(['role' => Role::Tenant])->id,
            'start_date'           => CarbonImmutable::now()->toDateString(),
            'end_date'             => CarbonImmutable::now()->addYear()->toDateString(),
            'monthly_rent'         => 10_000,
            'deposit_amount'       => 15_000,
            'deposit_interest_rate'=> 6.75,
            'escalation_percent'   => 8,
            'notice_period_days'   => 30,
            'status'               => 'active',
        ]);

        return [$agency, $agent, $lease, $listing];
    }

    // ── Rental commission math ──────────────────────────────────────────

    #[Test]
    public function rental_uses_seven_point_five_percent_of_annual_rent(): void
    {
        [$agency, $agent, $lease] = $this->buildScenario(splitPercent: 70);

        $commission = app(CommissionService::class)->calculate($lease, $agent, 'rental');

        // Deal value = 10,000 * 12 = 120,000
        // Gross commission = 120,000 * 7.5% = 9,000
        $this->assertEquals(120_000.00, (float) $commission->deal_value);
        $this->assertEquals(9_000.00,  (float) $commission->gross_commission);
    }

    #[Test]
    public function agent_split_and_agency_split_sum_to_gross(): void
    {
        [, $agent, $lease] = $this->buildScenario(splitPercent: 70);

        $commission = app(CommissionService::class)->calculate($lease, $agent, 'rental');

        $this->assertEquals(70.0,    (float) $commission->agent_split_percent);
        $this->assertEquals(6_300.00, (float) $commission->agent_amount);   // 9000 * 0.7
        $this->assertEquals(2_700.00, (float) $commission->agency_amount);  // 9000 - 6300
        $this->assertEquals(
            (float) $commission->gross_commission,
            (float) $commission->agent_amount + (float) $commission->agency_amount,
            'agent + agency should reconcile to gross'
        );
    }

    #[Test]
    public function non_vat_agency_does_not_deduct_vat(): void
    {
        [, $agent, $lease] = $this->buildScenario(vatRegistered: false);

        $commission = app(CommissionService::class)->calculate($lease, $agent, 'rental');

        $this->assertEquals(0.00, (float) $commission->vat_amount);
        $this->assertEquals((float) $commission->agent_amount, (float) $commission->agent_net);
    }

    #[Test]
    public function vat_registered_agency_deducts_15_percent_from_agent_amount(): void
    {
        [, $agent, $lease] = $this->buildScenario(
            vatRegistered: true,
            vatRate: 15.0,
            splitPercent: 70,
        );

        $commission = app(CommissionService::class)->calculate($lease, $agent, 'rental');

        // agent_amount = 6,300 → VAT = 945 → net = 5,355
        $this->assertEquals(945.00,   (float) $commission->vat_amount);
        $this->assertEquals(5_355.00, (float) $commission->agent_net);
    }

    // ── Sale commission ─────────────────────────────────────────────────

    #[Test]
    public function sale_uses_six_percent_of_sale_price(): void
    {
        [, $agent, $lease] = $this->buildScenario(splitPercent: 60);

        $commission = app(CommissionService::class)->calculate($lease, $agent, 'sale');

        // Deal value = 2,000,000 (sale_price on listing)
        // Gross = 2,000,000 * 6% = 120,000
        // Agent (60%) = 72,000; Agency = 48,000
        $this->assertEquals('sale', $commission->deal_type);
        $this->assertEquals(2_000_000.00, (float) $commission->deal_value);
        $this->assertEquals(120_000.00,   (float) $commission->gross_commission);
        $this->assertEquals(72_000.00,    (float) $commission->agent_amount);
        $this->assertEquals(48_000.00,    (float) $commission->agency_amount);
    }

    // ── Compliance blocking ─────────────────────────────────────────────

    #[Test]
    public function commission_is_blocked_when_agent_has_no_paystack_recipient(): void
    {
        [, $agent, $lease] = $this->buildScenario(paystackCode: null);

        $commission = app(CommissionService::class)->calculate($lease, $agent, 'rental');

        $this->assertEquals('blocked', $commission->status);
        $this->assertStringContainsString('paystack_missing', $commission->blocked_reason);
    }

    #[Test]
    public function commission_is_blocked_when_ffc_is_expired(): void
    {
        [, $agent, $lease] = $this->buildScenario(
            ffcExpires: CarbonImmutable::now()->subDay(),
        );

        $commission = app(CommissionService::class)->calculate($lease, $agent, 'rental');

        $this->assertEquals('blocked', $commission->status);
        $this->assertStringContainsString('ffc_expired', $commission->blocked_reason);
    }

    #[Test]
    public function commission_records_both_blocking_reasons_when_both_apply(): void
    {
        [, $agent, $lease] = $this->buildScenario(
            ffcExpires: CarbonImmutable::now()->subDay(),
            paystackCode: null,
        );

        $commission = app(CommissionService::class)->calculate($lease, $agent, 'rental');

        $this->assertEquals('blocked', $commission->status);
        $this->assertStringContainsString('paystack_missing', $commission->blocked_reason);
        $this->assertStringContainsString('ffc_expired', $commission->blocked_reason);
    }

    #[Test]
    public function commission_stays_pending_when_agent_is_compliant(): void
    {
        [, $agent, $lease] = $this->buildScenario();

        $commission = app(CommissionService::class)->calculate($lease, $agent, 'rental');

        $this->assertEquals('pending', $commission->status);
        $this->assertNull($commission->blocked_reason);
    }

    // ── Guardrails ──────────────────────────────────────────────────────

    #[Test]
    public function landlord_owned_listing_cannot_receive_an_agency_commission(): void
    {
        $landlordUser = User::factory()->create(['role' => Role::Landlord]);
        $landlord     = Landlord::create(['user_id' => $landlordUser->id]);

        $listing = Listing::create([
            'ulid'          => (string) Str::ulid(),
            'owner_type'    => Landlord::class,
            'owner_id'      => $landlord->id,
            'title'         => 'Direct rental',
            'slug'          => 'direct-' . Str::random(8),
            'description'   => 'Landlord owned',
            'listing_type'  => 'long_term_rent',
            'property_type' => 'apartment',
            'status'        => 'available',
            'monthly_rent'  => 8_000,
            'bedrooms'      => 1,
            'bathrooms'     => 1,
            'suburb'        => 'Greenside',
            'city'          => 'Johannesburg',
            'province'      => 'Gauteng',
        ]);

        $lease = Lease::create([
            'listing_id'           => $listing->id,
            'landlord_id'          => $landlordUser->id,
            'tenant_id'            => User::factory()->create(['role' => Role::Tenant])->id,
            'start_date'           => CarbonImmutable::now()->toDateString(),
            'end_date'             => CarbonImmutable::now()->addYear()->toDateString(),
            'monthly_rent'         => 8_000,
            'deposit_amount'       => 12_000,
            'deposit_interest_rate'=> 6.75,
            'escalation_percent'   => 8,
            'notice_period_days'   => 30,
            'status'               => 'active',
        ]);

        $someAgent = User::factory()->create(['role' => Role::Agent]);

        $this->expectException(\RuntimeException::class);
        app(CommissionService::class)->calculate($lease, $someAgent, 'rental');
    }

    // ── Monthly batch ──────────────────────────────────────────────────

    #[Test]
    public function monthly_batch_bundles_pending_and_approved_commissions(): void
    {
        [$agency, $agent, $lease] = $this->buildScenario();

        // Create 3 pending commissions
        $c1 = app(CommissionService::class)->calculate($lease, $agent, 'rental');
        $c2 = app(CommissionService::class)->calculate($lease, $agent, 'rental');
        $c3 = app(CommissionService::class)->calculate($lease, $agent, 'rental');
        $c3->update(['status' => 'approved']);

        // One blocked commission (paystack missing) should NOT be bundled
        $blocked = Commission::create([
            'agency_id'        => $agency->id,
            'agent_id'         => $agent->id,
            'deal_type'        => 'rental',
            'listing_id'       => $lease->listing_id,
            'lease_id'         => $lease->id,
            'deal_value'       => 60_000,
            'gross_commission' => 4_500,
            'agent_split_percent' => 70,
            'agent_amount'     => 3_150,
            'agency_amount'    => 1_350,
            'vat_amount'       => 0,
            'agent_net'        => 3_150,
            'status'           => 'blocked',
            'blocked_reason'   => 'paystack_missing',
        ]);

        $batch = app(CommissionService::class)->runMonthlyBatch($agency);

        $this->assertEquals($agency->id, $batch->agency_id);
        $this->assertEquals('pending', $batch->status);

        // 3 commissions × R9,000 gross each = R27,000
        $this->assertEquals(27_000.00, (float) $batch->total_gross);

        // c1, c2, c3 should be linked to the batch; blocked should not
        $this->assertEquals($batch->id, $c1->fresh()->payout_batch_id);
        $this->assertEquals($batch->id, $c2->fresh()->payout_batch_id);
        $this->assertEquals($batch->id, $c3->fresh()->payout_batch_id);
        $this->assertNull($blocked->fresh()->payout_batch_id);
    }

    #[Test]
    public function monthly_batch_uses_agency_payout_day(): void
    {
        [$agency, $agent, $lease] = $this->buildScenario();
        $agency->update(['payout_day' => 15]);

        app(CommissionService::class)->calculate($lease, $agent, 'rental');

        $batch = app(CommissionService::class)->runMonthlyBatch($agency);

        $this->assertEquals(15, CarbonImmutable::parse($batch->batch_date)->day);
    }

    #[Test]
    public function commissions_already_in_a_batch_are_not_re_bundled(): void
    {
        [$agency, $agent, $lease] = $this->buildScenario();

        app(CommissionService::class)->calculate($lease, $agent, 'rental');
        $firstBatch = app(CommissionService::class)->runMonthlyBatch($agency);

        // Add a new commission AFTER the first batch
        app(CommissionService::class)->calculate($lease, $agent, 'rental');
        $secondBatch = app(CommissionService::class)->runMonthlyBatch($agency);

        $this->assertNotEquals($firstBatch->id, $secondBatch->id);
        $this->assertEquals(9_000.00, (float) $firstBatch->total_gross);
        $this->assertEquals(9_000.00, (float) $secondBatch->total_gross,
            'second batch should only contain the one new commission');
    }
}
