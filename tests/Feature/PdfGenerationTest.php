<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\Contractor;
use App\Models\Inspection;
use App\Models\Lease;
use App\Models\Listing;
use App\Models\MaintenanceInvoice;
use App\Models\MaintenanceRequest;
use App\Models\RentPayment;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class PdfGenerationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    /**
     * Build a complete agency+agent+landlord+tenant+lease scenario.
     * @return array{agency:Agency, agent:User, tenant:User, lease:Lease, listing:Listing}
     */
    private function buildScenario(): array
    {
        $owner = User::factory()->create(['role' => Role::AgencyAdmin]);
        $agency = Agency::create([
            'user_id' => $owner->id,
            'name'    => 'PDF Test Agency',
            'slug'    => 'pdf-test-' . Str::random(6),
            'email'   => $owner->email,
            'status'  => 'active',
        ]);

        $agent = User::factory()->create(['role' => Role::Agent, 'status' => UserStatus::Active]);
        AgencyAgent::create([
            'agency_id' => $agency->id, 'user_id' => $agent->id,
            'commission_split_percent' => 70, 'lead_allocation_position' => 0, 'status' => 'active',
        ]);

        $tenant = User::factory()->create(['role' => Role::Tenant, 'status' => UserStatus::Active]);

        $listing = Listing::create([
            'ulid' => (string) Str::ulid(),
            'owner_type' => Agency::class, 'owner_id' => $agency->id, 'agent_id' => $agent->id,
            'title' => 'Test Property', 'slug' => 'test-' . Str::random(8),
            'description' => 'Test', 'listing_type' => 'long_term_rent', 'property_type' => 'apartment',
            'status' => 'leased', 'monthly_rent' => 10_000,
            'bedrooms' => 2, 'bathrooms' => 1, 'area_sqm' => 80,
            'suburb' => 'Sandton', 'city' => 'Johannesburg', 'province' => 'Gauteng',
        ]);

        $lease = Lease::create([
            'listing_id' => $listing->id, 'agency_id' => $agency->id, 'agent_id' => $agent->id,
            'tenant_id' => $tenant->id,
            'start_date' => CarbonImmutable::now()->subMonths(2)->toDateString(),
            'end_date'   => CarbonImmutable::now()->addMonths(10)->toDateString(),
            'monthly_rent' => 10_000, 'deposit_amount' => 15_000,
            'deposit_interest_rate' => 6.75, 'escalation_percent' => 8,
            'notice_period_days' => 30, 'status' => 'active',
            'signed_at' => CarbonImmutable::now()->subMonths(2),
        ]);

        return compact('agency', 'agent', 'tenant', 'lease', 'listing');
    }

    // ── Rent receipt ────────────────────────────────────────────────────

    #[Test]
    public function tenant_can_download_rent_receipt(): void
    {
        ['tenant' => $tenant, 'lease' => $lease] = $this->buildScenario();

        $payment = RentPayment::create([
            'lease_id' => $lease->id,
            'amount' => 10_000, 'period_month' => '2026-01',
            'due_date' => '2026-01-01', 'paid_at' => '2026-01-03 10:00:00',
            'payment_method' => 'paystack_eft',
            'paystack_reference' => 'PYS_TEST_001',
            'status' => 'paid',
        ]);

        $resp = $this->actingAs($tenant)->get("/tenant/payments/{$payment->id}/receipt.pdf");

        $resp->assertOk();
        $this->assertEquals('application/pdf', $resp->headers->get('content-type'));
        $this->assertGreaterThan(2000, strlen((string) $resp->getContent()));
        $this->assertStringStartsWith('%PDF', (string) $resp->getContent());
    }

    #[Test]
    public function tenant_cannot_download_other_tenants_receipt(): void
    {
        ['lease' => $lease] = $this->buildScenario();
        $other = User::factory()->create(['role' => Role::Tenant, 'status' => UserStatus::Active]);
        $otherLease = Lease::create([
            'listing_id' => $lease->listing_id, 'tenant_id' => $other->id, 'agency_id' => $lease->agency_id,
            'start_date' => CarbonImmutable::now()->toDateString(),
            'end_date'   => CarbonImmutable::now()->addYear()->toDateString(),
            'monthly_rent' => 5_000, 'deposit_amount' => 7_500,
            'deposit_interest_rate' => 6.75, 'escalation_percent' => 8,
            'notice_period_days' => 30, 'status' => 'active',
        ]);
        $payment = RentPayment::create([
            'lease_id' => $otherLease->id, 'amount' => 5_000, 'period_month' => '2026-01',
            'due_date' => '2026-01-01', 'paid_at' => '2026-01-03', 'status' => 'paid',
        ]);

        // Original tenant tries to grab payment for someone else's lease
        $myTenant = User::where('id', '!=', $other->id)->where('role', Role::Tenant)->first();
        $this->actingAs($myTenant)
            ->get("/tenant/payments/{$payment->id}/receipt.pdf")
            ->assertForbidden();
    }

    #[Test]
    public function unpaid_payment_cannot_yield_a_receipt(): void
    {
        ['tenant' => $tenant, 'lease' => $lease] = $this->buildScenario();

        $payment = RentPayment::create([
            'lease_id' => $lease->id, 'amount' => 10_000, 'period_month' => '2026-02',
            'due_date' => '2026-02-01', 'paid_at' => null, 'status' => 'pending',
        ]);

        $this->actingAs($tenant)
            ->get("/tenant/payments/{$payment->id}/receipt.pdf")
            ->assertNotFound();
    }

    // ── Lease agreement ─────────────────────────────────────────────────

    #[Test]
    public function tenant_can_download_lease_agreement(): void
    {
        ['tenant' => $tenant] = $this->buildScenario();

        $resp = $this->actingAs($tenant)->get('/tenant/lease/agreement.pdf');
        $resp->assertOk();
        $this->assertEquals('application/pdf', $resp->headers->get('content-type'));
        $this->assertStringStartsWith('%PDF', (string) $resp->getContent());
    }

    // ── Maintenance invoice ─────────────────────────────────────────────

    #[Test]
    public function contractor_can_download_their_own_invoice(): void
    {
        ['lease' => $lease, 'listing' => $listing, 'tenant' => $tenant] = $this->buildScenario();

        $contractorUser = User::factory()->create(['role' => Role::Contractor, 'status' => UserStatus::Active]);
        $contractor = Contractor::create([
            'user_id' => $contractorUser->id, 'business_name' => 'Test Plumbing',
            'specialities' => ['plumbing'], 'service_areas' => ['Sandton'],
            'vat_registered' => true, 'vat_number' => '4123456789',
            'cipc_verified_at' => now(), 'status' => 'active',
        ]);

        $req = MaintenanceRequest::create([
            'property_id' => $listing->id, 'lease_id' => $lease->id,
            'submitted_by' => $tenant->id, 'title' => 'Test job',
            'description' => 'Test', 'category' => 'plumbing', 'urgency' => 'medium',
            'assigned_to' => $contractorUser->id, 'status' => 'completed',
        ]);

        $invoice = MaintenanceInvoice::create([
            'maintenance_request_id' => $req->id, 'contractor_id' => $contractor->id,
            'line_items' => [['desc' => 'Labour', 'qty' => 2, 'unit' => 450]],
            'original_quote_total' => 1_000,
            'invoice_subtotal' => 900, 'vat_amount' => 135, 'invoice_total' => 1_035,
            'deviation_amount' => 35, 'status' => 'submitted',
            'submitted_at' => now(),
        ]);

        $resp = $this->actingAs($contractorUser)->get("/contractor/invoices/{$invoice->id}/pdf");
        $resp->assertOk();
        $this->assertEquals('application/pdf', $resp->headers->get('content-type'));
        $this->assertStringStartsWith('%PDF', (string) $resp->getContent());
    }

    #[Test]
    public function contractor_cannot_download_anothers_invoice(): void
    {
        ['lease' => $lease, 'listing' => $listing, 'tenant' => $tenant] = $this->buildScenario();

        $contractorA = User::factory()->create(['role' => Role::Contractor]);
        $contractorAModel = Contractor::create(['user_id' => $contractorA->id, 'business_name' => 'A', 'status' => 'active']);
        $contractorB = User::factory()->create(['role' => Role::Contractor]);
        Contractor::create(['user_id' => $contractorB->id, 'business_name' => 'B', 'status' => 'active']);

        $req = MaintenanceRequest::create([
            'property_id' => $listing->id, 'lease_id' => $lease->id,
            'submitted_by' => $tenant->id, 'title' => 'A job',
            'description' => 'Test', 'category' => 'plumbing', 'urgency' => 'low',
            'assigned_to' => $contractorA->id, 'status' => 'completed',
        ]);

        $invoice = MaintenanceInvoice::create([
            'maintenance_request_id' => $req->id, 'contractor_id' => $contractorAModel->id,
            'line_items' => [], 'original_quote_total' => 500,
            'invoice_subtotal' => 500, 'vat_amount' => 0, 'invoice_total' => 500,
            'deviation_amount' => 0, 'status' => 'submitted', 'submitted_at' => now(),
        ]);

        $this->actingAs($contractorB)
            ->get("/contractor/invoices/{$invoice->id}/pdf")
            ->assertForbidden();
    }

    // ── Inspection report ───────────────────────────────────────────────

    #[Test]
    public function agent_can_download_inspection_pdf_for_their_agency(): void
    {
        ['agent' => $agent, 'lease' => $lease, 'tenant' => $tenant] = $this->buildScenario();

        $inspection = Inspection::create([
            'lease_id' => $lease->id, 'type' => 'move_in',
            'conducted_by' => $agent->id, 'tenant_id' => $tenant->id,
            'status' => 'completed',
            'rooms' => [
                ['name' => 'Lounge', 'photos' => [['caption' => 'Wall']], 'notes' => 'Clean'],
                ['name' => 'Kitchen', 'photos' => [], 'notes' => ''],
            ],
            'agent_signed_at' => now(), 'agent_signature' => 'Sig',
            'tenant_signed_at' => now(), 'tenant_signature' => 'Sig',
            'deduction_total' => 0,
        ]);

        $resp = $this->actingAs($agent)->get("/agent/inspections/{$inspection->id}/pdf");
        $resp->assertOk();
        $this->assertEquals('application/pdf', $resp->headers->get('content-type'));
        $this->assertStringStartsWith('%PDF', (string) $resp->getContent());
    }

    #[Test]
    public function agent_from_another_agency_cannot_download_inspection(): void
    {
        ['lease' => $lease, 'tenant' => $tenant] = $this->buildScenario();

        // build a SECOND agency with its own agent
        $otherOwner = User::factory()->create(['role' => Role::AgencyAdmin]);
        $otherAgency = Agency::create([
            'user_id' => $otherOwner->id, 'name' => 'Other', 'slug' => 'other-' . Str::random(6),
            'email' => $otherOwner->email, 'status' => 'active',
        ]);
        $otherAgent = User::factory()->create(['role' => Role::Agent]);
        AgencyAgent::create([
            'agency_id' => $otherAgency->id, 'user_id' => $otherAgent->id,
            'commission_split_percent' => 70, 'lead_allocation_position' => 0, 'status' => 'active',
        ]);

        $conductor = User::factory()->create(['role' => Role::Agent]);
        $inspection = Inspection::create([
            'lease_id' => $lease->id, 'type' => 'move_in',
            'conducted_by' => $conductor->id, 'tenant_id' => $tenant->id,
            'status' => 'completed', 'rooms' => [], 'deduction_total' => 0,
        ]);

        $this->actingAs($otherAgent)
            ->get("/agent/inspections/{$inspection->id}/pdf")
            ->assertForbidden();
    }
}
