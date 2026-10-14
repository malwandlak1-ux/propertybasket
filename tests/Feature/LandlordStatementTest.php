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
                ->has('cashflow', 12) // default period: last 12 months
                ->where('filters.range', '12')
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

    #[Test]
    public function finance_filters_by_property_and_period(): void
    {
        // A second property of the same landlord: R5,000 rent paid 5 months ago only.
        $second = Listing::create([
            'ulid' => (string) Str::ulid(), 'owner_type' => Landlord::class, 'owner_id' => $this->landlord->id,
            'title' => 'Office OTB 1', 'address' => 'Office OTB 1', 'slug' => 'test-' . Str::random(8),
            'listing_type' => 'long_term_rent', 'property_type' => 'house', 'status' => 'leased',
        ]);
        $lease = Lease::create([
            'listing_id' => $second->id, 'tenant_id' => $this->tenant->id, 'landlord_id' => $this->landlordUser->id,
            'start_date' => now()->subMonths(5)->startOfMonth(), 'end_date' => now()->subMonths(5)->endOfMonth(),
            'monthly_rent' => 5000, 'deposit_amount' => 0, 'status' => 'expired',
        ]);
        RentPayment::create([
            'lease_id' => $lease->id, 'period_month' => now()->subMonths(5)->format('Y-m'), 'amount' => 5000,
            'due_date' => now()->subMonths(5)->startOfMonth(), 'paid_at' => now()->subMonths(5)->startOfMonth()->addDay(),
            'status' => 'paid', 'payment_method' => 'manual',
        ]);

        $as = $this->actingAs($this->landlordUser);

        // All properties, last 12 months: R9,000 + R5,000 rent, R800 maintenance.
        $as->get('/landlord/finance?range=12')->assertInertia(fn (Assert $p) => $p
            ->where('income_statement.rent_income', 14000)
            ->has('properties', 2)
            ->where('filters.property', null));

        // Last 3 months excludes the older office rent.
        $as->get('/landlord/finance?range=3')->assertInertia(fn (Assert $p) => $p
            ->where('income_statement.rent_income', 9000)
            ->has('cashflow', 3));

        // One property only.
        $as->get("/landlord/finance?property={$second->id}&range=12")->assertInertia(fn (Assert $p) => $p
            ->where('filters.property', $second->id)
            ->where('income_statement.rent_income', 5000)
            ->where('income_statement.maintenance', 0)
            ->has('by_property', 1));

        // Full lease period for that property starts at its lease.
        $as->get("/landlord/finance?property={$second->id}&range=lease")->assertInertia(fn (Assert $p) => $p
            ->where('filters.from', now()->subMonths(5)->startOfMonth()->format('d M Y')));

        // Statement PDFs follow the same filters.
        $pdf = $as->get("/landlord/finance/statement.pdf?property={$second->id}&range=6&download=1");
        $pdf->assertOk();
        $this->assertStringContainsString('owner-statement-office-otb-1-last-6-months', (string) $pdf->headers->get('Content-Disposition'));
        $as->get('/landlord/finance/statement.pdf?range=3')->assertOk();
        $as->get("/landlord/finance/statement.pdf?property={$this->listing->id}&month=" . now()->format('Y-m'))->assertOk();

        $this->assertSame(5000.0, app(LandlordStatementService::class)->full($this->landlord, $second->id)['income']);
    }

    #[Test]
    public function another_landlords_property_cannot_be_filtered_on(): void
    {
        [, , $foreign] = $this->landlordWithProperty('99 Other Road');

        $this->actingAs($this->landlordUser)->get("/landlord/finance?property={$foreign->id}")->assertNotFound();
        $this->actingAs($this->landlordUser)->get("/landlord/finance/statement.pdf?property={$foreign->id}")->assertNotFound();
    }
}
