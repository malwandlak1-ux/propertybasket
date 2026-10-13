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

/** A tenant who has paid this month must not be shown this month's rent as due. */
class TenantRentDueTest extends TestCase
{
    use RefreshDatabase;

    private User $tenant;
    private Lease $lease;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $landlordUser = User::factory()->create(['role' => Role::Landlord, 'status' => UserStatus::Active]);
        $landlord = Landlord::create(['user_id' => $landlordUser->id]);
        $this->tenant = User::factory()->create(['role' => Role::Tenant, 'status' => UserStatus::Active]);
        $listing = Listing::create([
            'ulid' => (string) Str::ulid(), 'owner_type' => Landlord::class, 'owner_id' => $landlord->id,
            'title' => '45 Test Street', 'slug' => 'test-' . Str::random(8), 'listing_type' => 'long_term_rent',
            'property_type' => 'house', 'status' => 'leased',
        ]);
        $this->lease = Lease::create([
            'listing_id' => $listing->id, 'tenant_id' => $this->tenant->id, 'landlord_id' => $landlordUser->id,
            'start_date' => now()->subMonths(3)->startOfMonth(), 'end_date' => now()->addYear(),
            'monthly_rent' => 3000, 'deposit_amount' => 3000, 'status' => 'active',
        ]);
        app(LeaseBillingService::class)->ensureCharges($this->lease);
    }

    #[Test]
    public function fully_paid_tenant_sees_next_months_rent(): void
    {
        RentPayment::where('lease_id', $this->lease->id)->update(['status' => 'paid', 'paid_at' => now(), 'payment_method' => 'manual']);

        $out = app(LeaseBillingService::class)->outstanding($this->lease);
        $this->assertTrue($out['current_paid']);
        $this->assertSame(0.0, $out['total_due']);

        $next = CarbonImmutable::now()->startOfMonth()->addMonth();
        $this->actingAs($this->tenant)->get('/tenant')
            ->assertOk()
            ->assertInertia(fn (Assert $p) => $p
                ->where('next_due.has_arrears', false)
                ->where('next_due.period_month', $next->format('Y-m'))
                ->where('next_due.due_date', $next->format('d M Y'))
                ->where('next_due.amount', 3000)
            );
    }

    #[Test]
    public function unpaid_months_still_show_as_due(): void
    {
        $out = app(LeaseBillingService::class)->outstanding($this->lease);

        $this->assertFalse($out['current_paid']);
        $this->assertSame(12000.0, $out['total_due']); // 3 arrears months + current
    }

    #[Test]
    public function lease_without_deposit_never_shows_a_deposit_due(): void
    {
        $this->lease->update(['deposit_amount' => 0]);
        \App\Models\Deposit::where('lease_id', $this->lease->id)->delete();

        $this->actingAs($this->tenant)->get('/tenant')
            ->assertOk()
            ->assertInertia(fn (Assert $p) => $p
                ->where('deposit.none', true)
                ->where('deposit.is_due', false)
            );

        $this->actingAs($this->tenant)->get('/tenant/documents')
            ->assertOk()
            ->assertInertia(fn (Assert $p) => $p->where('documents', fn ($docs) => collect($docs)->pluck('id')->doesntContain('deposit-receipt')));
    }

    #[Test]
    public function tenant_inbox_always_has_a_thread_with_the_landlord(): void
    {
        $this->actingAs($this->tenant)->get('/tenant/messages')
            ->assertOk()
            ->assertInertia(fn (Assert $p) => $p->has('conversations', 1)->where('active.title', $this->lease->landlord->name));

        // Second visit re-uses the same thread; the landlord can see it too.
        $this->actingAs($this->tenant)->get('/tenant/messages');
        $this->assertSame(1, \App\Models\Conversation::where('type', 'landlord_tenant')->count());
        $conv = \App\Models\Conversation::first();
        $this->assertEqualsCanonicalizing([$this->lease->landlord_id, $this->tenant->id], $conv->participants);

        $this->actingAs($this->tenant)->post("/tenant/messages/{$conv->id}", ['body' => 'Hello'])->assertRedirect();
        $this->assertDatabaseHas('messages', ['conversation_id' => $conv->id, 'body' => 'Hello']);
    }
}
