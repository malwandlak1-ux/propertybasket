<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\DebitOrder;
use App\Models\DebitOrderCollection;
use App\Models\Landlord;
use App\Models\Lease;
use App\Models\Listing;
use App\Models\RentPayment;
use App\Models\User;
use App\Notifications\DebitOrderCollectionResult;
use App\Notifications\RentPaymentReceived;
use App\Services\DebitOrderCollector;
use Carbon\CarbonImmutable;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** Automatic rent collection on debit-order mandates. */
class DebitOrderCollectionTest extends TestCase
{
    use RefreshDatabase;

    private User $tenant;
    private User $landlordUser;
    private Lease $lease;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        Notification::fake();
        config(['services.paystack.stub' => true, 'services.debit_orders.driver' => 'auto']);
        $this->at('2026-10-15 09:00');

        $this->landlordUser = User::factory()->create(['role' => Role::Landlord, 'status' => UserStatus::Active]);
        $this->landlordUser->assignRole('landlord');
        $landlord = Landlord::create(['user_id' => $this->landlordUser->id]);
        $landlord->activateSubscription('promo', now()->addYear());
        $this->tenant = User::factory()->create(['role' => Role::Tenant, 'status' => UserStatus::Active]);
        $this->tenant->forceFill([
            'bank_name' => 'Capitec Bank', 'bank_account_holder' => 'T Tenant', 'bank_account_number' => '1234567890',
            'bank_code' => '470010', 'bank_account_type' => 'savings',
        ])->save();
        $listing = Listing::create([
            'ulid' => (string) Str::ulid(), 'owner_type' => Landlord::class, 'owner_id' => $landlord->id,
            'title' => '45 Test Street', 'address' => '45 Test Street', 'slug' => 'test-' . Str::random(8),
            'listing_type' => 'long_term_rent', 'property_type' => 'house', 'status' => 'leased',
        ]);
        $this->lease = Lease::create([
            'listing_id' => $listing->id, 'tenant_id' => $this->tenant->id, 'landlord_id' => $this->landlordUser->id,
            'start_date' => '2026-08-01', 'end_date' => '2027-07-31',
            'monthly_rent' => 4000, 'deposit_amount' => 0, 'status' => 'active',
        ]);
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function at(string $when): void
    {
        CarbonImmutable::setTestNow(CarbonImmutable::parse($when));
        Carbon::setTestNow(Carbon::parse($when));
    }

    private function activate(int $day): void
    {
        $this->actingAs($this->tenant)->post('/tenant/debit-order', ['debit_day' => $day, 'authorise' => true])
            ->assertSessionHasNoErrors();
    }

    private function charge(string $period): RentPayment
    {
        return RentPayment::where('lease_id', $this->lease->id)->where('period_month', $period)->firstOrFail();
    }

    private function collectNow(): array
    {
        return app(DebitOrderCollector::class)->run();
    }

    #[Test]
    public function collects_on_the_debit_date_and_updates_landlord_income(): void
    {
        $this->activate(1);
        $this->assertSame('2026-10-15', DebitOrder::first()->collect_from->toDateString());

        // Mid-October: October rent was due before the mandate existed — not collected.
        $this->assertSame(['succeeded' => 0, 'failed' => 0], $this->collectNow());
        $this->assertNotSame('paid', $this->charge('2026-10')->status);

        // 1 November: November rent is collected.
        $this->at('2026-11-01 07:00');
        $this->assertSame(['succeeded' => 1, 'failed' => 0], $this->collectNow());

        $nov = $this->charge('2026-11');
        $this->assertSame('paid', $nov->status);
        $this->assertSame('debit_order', $nov->payment_method);
        $this->assertNotNull($nov->paid_at);
        $this->assertSame('succeeded', DebitOrderCollection::first()->status);
        Notification::assertSentTo($this->tenant, RentPaymentReceived::class);
        Notification::assertSentTo($this->landlordUser, DebitOrderCollectionResult::class, fn ($n) => $n->collection->status === 'succeeded');

        // Running again the same day collects nothing more.
        $this->assertSame(['succeeded' => 0, 'failed' => 0], $this->collectNow());
        $this->assertSame(1, DebitOrderCollection::count());

        // Landlord dashboards see the income straight away.
        $this->actingAs($this->landlordUser)->get('/landlord/finance?range=3')
            ->assertInertia(fn (Assert $p) => $p
                ->where('kpis.this_month_collected', 4000)
                ->where('income_statement.rent_income', 4000));
    }

    #[Test]
    public function waits_for_the_chosen_debit_day(): void
    {
        $this->activate(5);
        $this->at('2026-11-03 10:00');
        $this->assertSame(['succeeded' => 0, 'failed' => 0], $this->collectNow());

        $this->at('2026-11-05 10:00');
        $this->assertSame(['succeeded' => 1, 'failed' => 0], $this->collectNow());
        $this->assertSame('paid', $this->charge('2026-11')->status);

        $this->actingAs($this->tenant)->get('/tenant/settings')
            ->assertInertia(fn (Assert $p) => $p
                ->where('debit_order.next_date', '05 Dec 2026')
                ->has('debit_order.collections', 1)
                ->where('debit_order.collections.0.status', 'succeeded'));
    }

    #[Test]
    public function a_declined_debit_is_reported_and_retried_next_month(): void
    {
        $this->tenant->forceFill(['bank_account_number' => '0000000000'])->save();
        $this->activate(1);

        $this->at('2026-11-01 07:00');
        $this->assertSame(['succeeded' => 0, 'failed' => 1], $this->collectNow());
        $this->assertNotSame('paid', $this->charge('2026-11')->status);
        Notification::assertSentTo($this->tenant, DebitOrderCollectionResult::class, fn ($n) => $n->collection->status === 'failed');
        Notification::assertSentTo($this->landlordUser, DebitOrderCollectionResult::class);

        // Not retried again in November…
        $this->at('2026-11-20 07:00');
        $this->assertSame(['succeeded' => 0, 'failed' => 0], $this->collectNow());

        // …but tried again (with December's rent) on the December debit date.
        $this->tenant->forceFill(['bank_account_number' => '1234567890'])->save();
        $this->actingAs($this->tenant)->patch('/tenant/settings/banking', [
            'bank_name' => 'Capitec Bank', 'bank_account_holder' => 'T Tenant', 'bank_account_number' => '1234567890',
            'bank_branch_code' => '470010', 'bank_account_type' => 'savings',
        ]);
        $this->at('2026-12-01 07:00');
        $this->assertSame(['succeeded' => 2, 'failed' => 0], $this->collectNow());
        $this->assertSame('paid', $this->charge('2026-11')->status);
        $this->assertSame('paid', $this->charge('2026-12')->status);
    }

    #[Test]
    public function nothing_is_collected_when_collection_is_disabled_or_cancelled(): void
    {
        $this->activate(1);

        config(['services.debit_orders.driver' => 'disabled']);
        $this->at('2026-11-01 07:00');
        $this->assertSame(['succeeded' => 0, 'failed' => 0], $this->collectNow());

        config(['services.debit_orders.driver' => 'auto']);
        $this->actingAs($this->tenant)->post('/tenant/debit-order/cancel');
        $this->assertSame(['succeeded' => 0, 'failed' => 0], $this->collectNow());
        $this->assertSame(0, DebitOrderCollection::count());
    }

    #[Test]
    public function changing_the_debit_day_keeps_the_original_start(): void
    {
        $this->activate(1);
        $this->at('2026-10-20 09:00');
        $this->activate(3);

        $this->assertSame('2026-10-15', DebitOrder::where('status', 'active')->first()->collect_from->toDateString());
        $this->artisan('debit:collect')->assertSuccessful();
    }
}
