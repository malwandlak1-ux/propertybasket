<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\DebitOrder;
use App\Models\Landlord;
use App\Models\Lease;
use App\Models\Listing;
use App\Models\User;
use App\Notifications\DebitOrderChanged;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** Tenant Settings: own banking details + rent debit order from them. */
class TenantBankingDebitOrderTest extends TestCase
{
    use RefreshDatabase;

    private User $tenant;
    private User $landlordUser;
    private Lease $lease;

    private const BANK = [
        'bank_name' => 'Capitec Bank', 'bank_account_holder' => 'T Tenant',
        'bank_account_number' => '1234 567 890', 'bank_branch_code' => '470010', 'bank_account_type' => 'savings',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        Notification::fake();

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
            'start_date' => now()->startOfMonth(), 'end_date' => now()->addYear(),
            'monthly_rent' => 3000, 'deposit_amount' => 0, 'status' => 'active',
        ]);
    }

    #[Test]
    public function tenant_saves_banking_details(): void
    {
        $this->actingAs($this->tenant)->patch('/tenant/settings/banking', self::BANK)->assertRedirect()->assertSessionHasNoErrors();

        $t = $this->tenant->fresh();
        $this->assertSame('1234567890', $t->bank_account_number);
        $this->assertSame('470010', $t->bank_code);
        $this->assertSame('savings', $t->bank_account_type);

        $this->actingAs($this->tenant)->get('/tenant/settings')->assertInertia(fn (Assert $p) => $p
            ->where('banking.complete', true)
            ->where('banking.bank_name', 'Capitec Bank')
            ->where('debit_order', null));

        $this->actingAs($this->tenant)
            ->patch('/tenant/settings/banking', ['bank_account_number' => 'abc'] + self::BANK)
            ->assertSessionHasErrors('bank_account_number');
    }

    #[Test]
    public function debit_order_needs_saved_banking_and_authorisation(): void
    {
        $this->actingAs($this->tenant)->post('/tenant/debit-order', ['debit_day' => 1, 'authorise' => true])
            ->assertSessionHasErrors('debit_day');

        $this->actingAs($this->tenant)->patch('/tenant/settings/banking', self::BANK);
        $this->actingAs($this->tenant)->post('/tenant/debit-order', ['debit_day' => 1])
            ->assertSessionHasErrors('authorise');

        $this->assertSame(0, DebitOrder::count());
    }

    #[Test]
    public function tenant_activates_changes_and_cancels_a_debit_order(): void
    {
        $as = $this->actingAs($this->tenant);
        $as->patch('/tenant/settings/banking', self::BANK);

        $as->post('/tenant/debit-order', ['debit_day' => 3, 'authorise' => true])->assertRedirect()->assertSessionHasNoErrors();
        $do = DebitOrder::where('lease_id', $this->lease->id)->where('status', 'active')->firstOrFail();
        $this->assertSame('1234567890', $do->account_number);
        $this->assertSame(3, $do->debit_day);
        Notification::assertSentTo($this->landlordUser, DebitOrderChanged::class, fn ($n) => $n->event === 'activated');

        // The landlord sees it on their tenant list.
        $this->actingAs($this->landlordUser)->get('/landlord/tenants')
            ->assertInertia(fn (Assert $p) => $p->where('tenants.0.debit_order_day', 3));

        // New bank account: the active mandate follows it.
        $this->actingAs($this->tenant)->patch('/tenant/settings/banking', ['bank_account_number' => '9988776655'] + self::BANK);
        $this->assertSame('9988776655', $do->fresh()->account_number);
        Notification::assertSentTo($this->landlordUser, DebitOrderChanged::class, fn ($n) => $n->event === 'updated');

        $this->actingAs($this->tenant)->get('/tenant/settings')
            ->assertInertia(fn (Assert $p) => $p->where('debit_order.debit_day', 3)->where('debit_order.account_masked', '••••••6655'));

        $this->actingAs($this->tenant)->post('/tenant/debit-order/cancel')->assertRedirect();
        $this->assertSame('cancelled', $do->fresh()->status);
        Notification::assertSentTo($this->landlordUser, DebitOrderChanged::class, fn ($n) => $n->event === 'cancelled');
    }
}
