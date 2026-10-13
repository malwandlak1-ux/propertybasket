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
use App\Services\TenantStatementService;
use Carbon\CarbonImmutable;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** Tenant full + monthly rent statements (ledger maths + PDF download), and tenant logo rules. */
class TenantStatementTest extends TestCase
{
    use RefreshDatabase;

    private User $tenant;
    private User $landlordUser;
    private Lease $lease;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->landlordUser = User::factory()->create(['role' => Role::Landlord, 'status' => UserStatus::Active]);
        $landlord = Landlord::create(['user_id' => $this->landlordUser->id]);
        $this->tenant = User::factory()->create(['role' => Role::Tenant, 'status' => UserStatus::Active, 'name' => 'Test Tenant']);
        $listing = Listing::create([
            'ulid' => (string) Str::ulid(), 'owner_type' => Landlord::class, 'owner_id' => $landlord->id,
            'title' => '45 Test Street', 'slug' => 'test-' . Str::random(8), 'listing_type' => 'long_term_rent',
            'property_type' => 'house', 'status' => 'leased',
        ]);
        // Four charges (3 prior months + current); the two oldest paid on the 1st.
        $this->lease = Lease::create([
            'listing_id' => $listing->id, 'tenant_id' => $this->tenant->id, 'landlord_id' => $this->landlordUser->id,
            'start_date' => now()->subMonths(3)->startOfMonth(), 'end_date' => now()->addYear(),
            'monthly_rent' => 3000, 'deposit_amount' => 3000, 'status' => 'active',
        ]);
        app(LeaseBillingService::class)->ensureCharges($this->lease);
        RentPayment::where('lease_id', $this->lease->id)->orderBy('due_date')->limit(2)->get()
            ->each(fn ($p) => $p->update(['status' => 'paid', 'paid_at' => CarbonImmutable::parse($p->due_date)->setTime(10, 0), 'payment_method' => 'manual']));
    }

    #[Test]
    public function full_statement_runs_a_correct_balance(): void
    {
        $s = app(TenantStatementService::class)->full($this->lease);

        $this->assertSame(0.0, $s['opening']);
        $this->assertSame(12000.0, $s['charged']);
        $this->assertSame(6000.0, $s['paid']);
        $this->assertSame(6000.0, $s['closing']); // two months unpaid
        $this->assertCount(6, $s['lines']);       // 4 charges + 2 payments
    }

    #[Test]
    public function monthly_statement_carries_the_opening_balance(): void
    {
        $third = CarbonImmutable::now()->subMonth()->format('Y-m');   // first unpaid month
        $s = app(TenantStatementService::class)->month($this->lease, $third);

        $this->assertSame(0.0, $s['opening']);      // first two months charged + paid
        $this->assertSame(3000.0, $s['charged']);
        $this->assertSame(0.0, $s['paid']);
        $this->assertSame(3000.0, $s['closing']);

        $months = app(TenantStatementService::class)->availableMonths($this->lease);
        $this->assertCount(4, $months);
        $this->assertSame(CarbonImmutable::now()->format('Y-m'), $months[0]['period']); // newest first
    }

    #[Test]
    public function tenant_downloads_full_and_monthly_pdfs(): void
    {
        $this->actingAs($this->tenant)->get('/tenant/payments')
            ->assertInertia(fn (Assert $p) => $p->has('statements', 4));

        $full = $this->actingAs($this->tenant)->get('/tenant/payments/statement.pdf?download=1');
        $full->assertOk();
        $this->assertSame('application/pdf', $full->headers->get('Content-Type'));

        $month = CarbonImmutable::now()->subMonths(2)->format('Y-m');
        $this->actingAs($this->tenant)->get("/tenant/payments/statement.pdf?month={$month}")->assertOk();
    }

    #[Test]
    public function out_of_range_or_bad_months_404(): void
    {
        $before = CarbonImmutable::now()->subYears(2)->format('Y-m');
        $this->actingAs($this->tenant)->get("/tenant/payments/statement.pdf?month={$before}")->assertNotFound();
        $this->actingAs($this->tenant)->get('/tenant/payments/statement.pdf?month=2026-13')->assertNotFound();
        $this->actingAs($this->tenant)->get('/tenant/payments/statement.pdf?month=../../x')->assertNotFound();
    }

    #[Test]
    public function tenant_cannot_change_logo_and_sees_landlords(): void
    {
        Storage::fake('public');

        $this->actingAs($this->tenant)->post('/settings/logo', [
            'logo' => \Illuminate\Http\UploadedFile::fake()->image('logo.png', 300, 100),
        ])->assertForbidden();
        $this->actingAs($this->tenant)->delete('/settings/logo')->assertForbidden();
        $this->assertNull($this->tenant->fresh()->dashboard_logo);

        $this->landlordUser->forceFill(['dashboard_logo' => 'logos/landlord.png'])->save();

        $this->actingAs($this->tenant)->get('/tenant/payments')
            ->assertInertia(fn (Assert $p) => $p
                ->where('appearance.can_upload_logo', false)
                ->where('appearance.logo_url', '/storage/logos/landlord.png')
                ->where('appearance.logo_inherited', true)
            );
    }
}
