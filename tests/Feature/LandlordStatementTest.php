<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Contractor;
use App\Models\Landlord;
use App\Models\Lease;
use App\Models\Listing;
use App\Models\MaintenanceInvoice;
use App\Models\MaintenanceRequest;
use App\Models\RentPayment;
use App\Models\User;
use App\Services\LandlordStatementService;
use App\Services\LeaseBillingService;
use Carbon\CarbonImmutable;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** Landlord owner statements: rent received − maintenance paid (cash basis). */
class LandlordStatementTest extends TestCase
{
    use RefreshDatabase;

    private User $landlordUser;
    private Landlord $landlord;
    private Listing $listing;
    private User $tenant;
    private Contractor $contractor;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        [$this->landlordUser, $this->landlord, $this->listing] = $this->landlordWithProperty('45 Test Street');
        $this->tenant = User::factory()->create(['role' => Role::Tenant, 'status' => UserStatus::Active]);
        $contractorUser = User::factory()->create(['role' => Role::Contractor, 'status' => UserStatus::Active]);
        $this->contractor = Contractor::create(['user_id' => $contractorUser->id, 'business_name' => 'Fix-It Plumbing', 'status' => 'active']);

        // Lease from 2 months ago: all three months of rent paid (R3,000 each).
        $lease = Lease::create([
            'listing_id' => $this->listing->id, 'tenant_id' => $this->tenant->id, 'landlord_id' => $this->landlordUser->id,
            'start_date' => now()->subMonths(2)->startOfMonth(), 'end_date' => now()->addYear(),
            'monthly_rent' => 3000, 'deposit_amount' => 3000, 'status' => 'active',
        ]);
        app(LeaseBillingService::class)->ensureCharges($lease);
        RentPayment::where('lease_id', $lease->id)->get()->each(fn ($p) => $p->update([
            'status' => 'paid', 'paid_at' => CarbonImmutable::parse($p->due_date)->setTime(10, 0), 'payment_method' => 'manual',
        ]));

        // R800 maintenance paid this month on this property.
        $this->paidInvoice($this->listing, 800, now()->startOfMonth()->addDay());
    }

    private function landlordWithProperty(string $address): array
    {
        $user = User::factory()->create(['role' => Role::Landlord, 'status' => UserStatus::Active]);
        $user->assignRole('landlord');
        $landlord = Landlord::create(['user_id' => $user->id]);
        $landlord->activateSubscription('promo', now()->addYear());
        $listing = Listing::create([
            'ulid' => (string) Str::ulid(), 'owner_type' => Landlord::class, 'owner_id' => $landlord->id,
            'title' => $address, 'address' => $address, 'slug' => 'test-' . Str::random(8),
            'listing_type' => 'long_term_rent', 'property_type' => 'house', 'status' => 'leased',
        ]);

        return [$user, $landlord, $listing];
    }

    private function paidInvoice(Listing $listing, float $total, \DateTimeInterface $paidAt, string $status = 'paid'): void
    {
        $request = MaintenanceRequest::create([
            'property_id' => $listing->id, 'submitted_by' => $this->tenant->id, 'title' => 'Burst geyser',
            'description' => 'Geyser leaking', 'category' => 'plumbing', 'urgency' => 'high', 'status' => 'paid',
        ]);
        MaintenanceInvoice::create([
            'maintenance_request_id' => $request->id, 'contractor_id' => $this->contractor->id,
            'line_items' => [], 'invoice_subtotal' => $total, 'vat_amount' => 0, 'invoice_total' => $total,
            'status' => $status, 'paid_at' => $status === 'paid' ? $paidAt : null,
        ]);
    }

    #[Test]
    public function statement_is_income_less_maintenance(): void
    {
        $s = app(LandlordStatementService::class)->full($this->landlord);

        $this->assertSame(9000.0, $s['income']);
        $this->assertSame(800.0, $s['maintenance']);
        $this->assertSame(8200.0, $s['net']);
        $this->assertCount(4, $s['lines']);

        $month = app(LandlordStatementService::class)->month($this->landlord, now()->format('Y-m'));
        $this->assertSame(3000.0, $month['income']);
        $this->assertSame(800.0, $month['maintenance']);
        $this->assertSame(2200.0, $month['net']);
    }

    #[Test]
    public function unpaid_invoices_and_other_landlords_are_excluded(): void
    {
        $this->paidInvoice($this->listing, 500, now(), 'approved');            // not yet paid
        [, , $otherListing] = $this->landlordWithProperty('9 Other Road');
        $this->paidInvoice($otherListing, 999, now());                         // someone else's property

        $s = app(LandlordStatementService::class)->full($this->landlord);
        $this->assertSame(800.0, $s['maintenance']);
    }

    #[Test]
    public function finance_page_and_pdfs(): void
    {
        $this->actingAs($this->landlordUser)->get('/landlord/finance')
            ->assertOk()
            ->assertInertia(fn (Assert $p) => $p
                ->component('Landlord/Finance')
                ->has('statements', 3)
                ->has('cashflow', 6)
                ->has('maintenance', 1)
                ->where('income_statement.maintenance', 800)
            );

        $full = $this->actingAs($this->landlordUser)->get('/landlord/finance/statement.pdf?download=1');
        $full->assertOk();
        $this->assertSame('application/pdf', $full->headers->get('Content-Type'));

        $this->actingAs($this->landlordUser)->get('/landlord/finance/statement.pdf?month=' . now()->format('Y-m'))->assertOk();
        $this->actingAs($this->landlordUser)->get('/landlord/finance/statement.pdf?month=2001-01')->assertNotFound();
        $this->actingAs($this->landlordUser)->get('/landlord/finance/statement.pdf?month=bad')->assertNotFound();
    }

    #[Test]
    public function tenants_cannot_reach_landlord_statements(): void
    {
        $this->actingAs($this->tenant)->get('/landlord/finance/statement.pdf')->assertForbidden();
    }
}
