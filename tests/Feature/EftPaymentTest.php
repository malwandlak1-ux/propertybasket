<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\DebitOrder;
use App\Models\EftPayment;
use App\Models\Landlord;
use App\Models\Lease;
use App\Models\Listing;
use App\Models\RentPayment;
use App\Models\User;
use App\Notifications\EftPaymentReviewed;
use App\Notifications\EftPaymentSubmitted;
use App\Notifications\RentPaymentReceived;
use App\Services\DebitOrderCollector;
use App\Services\LeaseBillingService;
use Carbon\CarbonImmutable;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** Paying rent by EFT: tenant reports it, landlord confirms or rejects. */
class EftPaymentTest extends TestCase
{
    use RefreshDatabase;

    private User $tenant;
    private User $landlordUser;
    private Landlord $landlord;
    private Lease $lease;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        Notification::fake();
        Storage::fake('local');
        $this->at('2026-11-04 09:00');

        $this->landlordUser = User::factory()->create(['role' => Role::Landlord, 'status' => UserStatus::Active, 'name' => 'Careline Clinic']);
        $this->landlordUser->assignRole('landlord');
        $this->landlord = Landlord::create([
            'user_id' => $this->landlordUser->id,
            'bank_name' => 'First National Bank (FNB)', 'bank_account_holder' => 'Careline Clinic (Pty) Ltd.',
            'bank_account_number' => '62493828647', 'bank_branch_code' => '258611', 'bank_account_type' => 'cheque',
        ]);
        $this->landlord->activateSubscription('promo', now()->addYear());
        $this->tenant = User::factory()->create(['role' => Role::Tenant, 'status' => UserStatus::Active, 'name' => 'Melissa Parkin Inc.']);
        $listing = Listing::create([
            'ulid' => (string) Str::ulid(), 'owner_type' => Landlord::class, 'owner_id' => $this->landlord->id,
            'title' => 'Office OTB 1', 'address' => 'Office OTB 1', 'slug' => 'test-' . Str::random(8),
            'listing_type' => 'long_term_rent', 'property_type' => 'house', 'status' => 'leased',
        ]);
        $this->lease = Lease::create([
            'listing_id' => $listing->id, 'tenant_id' => $this->tenant->id, 'landlord_id' => $this->landlordUser->id,
            'start_date' => '2026-11-01', 'end_date' => '2027-10-31',
            'monthly_rent' => 5000, 'deposit_amount' => 0, 'status' => 'active',
        ]);
        app(LeaseBillingService::class)->ensureCharges($this->lease);
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

    private function nov(): RentPayment
    {
        return RentPayment::where('lease_id', $this->lease->id)->where('period_month', '2026-11')->firstOrFail();
    }

    private function report(array $overrides = []): \Illuminate\Testing\TestResponse
    {
        return $this->actingAs($this->tenant)->post('/tenant/payments/eft', array_merge([
            'rent_payment_id' => $this->nov()->id, 'amount' => 5000, 'paid_on' => '2026-11-03',
            'proof' => UploadedFile::fake()->create('pop.pdf', 120, 'application/pdf'),
        ], $overrides));
    }

    #[Test]
    public function tenant_sees_the_landlords_account_and_lease_reference(): void
    {
        $this->actingAs($this->tenant)->get('/tenant/payments')->assertInertia(fn (Assert $p) => $p
            ->where('payee.account', '62493828647')
            ->where('payee.branch', '258611')
            ->where('payee.holder', 'Careline Clinic (Pty) Ltd.')
            ->where('payee.reference', 'Melissa Parkin Inc. Rental'));

        $this->lease->update(['payment_reference' => 'Melissa Parkin Rental']);
        $this->actingAs($this->tenant)->get('/tenant/payments')
            ->assertInertia(fn (Assert $p) => $p->where('payee.reference', 'Melissa Parkin Rental'));
    }

    #[Test]
    public function tenant_reports_an_eft_and_the_landlord_confirms_it(): void
    {
        $this->report()->assertRedirect()->assertSessionHasNoErrors();

        $eft = EftPayment::firstOrFail();
        $this->assertSame('submitted', $eft->status);
        Storage::disk('local')->assertExists($eft->proof_path);
        Notification::assertSentTo($this->landlordUser, EftPaymentSubmitted::class);
        $this->assertNotSame('paid', $this->nov()->status);

        // Shown as awaiting confirmation; can't be reported twice.
        $this->actingAs($this->tenant)->get('/tenant/payments')
            ->assertInertia(fn (Assert $p) => $p->where('upcoming.0.eft_pending', '03 Nov 2026'));
        $this->report()->assertSessionHasErrors('rent_payment_id');

        // Landlord sees it on Finance, can open the proof, and confirms.
        $this->actingAs($this->landlordUser)->get('/landlord/finance')
            ->assertInertia(fn (Assert $p) => $p->has('eft_pending', 1)->where('eft_pending.0.amount', 5000));
        $this->actingAs($this->landlordUser)->get("/landlord/finance/eft/{$eft->id}/proof")->assertOk();

        $this->actingAs($this->landlordUser)->post("/landlord/finance/eft/{$eft->id}/confirm")->assertRedirect();

        $nov = $this->nov();
        $this->assertSame('paid', $nov->status);
        $this->assertSame('manual', $nov->payment_method);
        $this->assertSame('2026-11-03', $nov->paid_at->toDateString());
        $this->assertSame('confirmed', $eft->fresh()->status);
        Notification::assertSentTo($this->tenant, EftPaymentReviewed::class, fn ($n) => $n->eft->status === 'confirmed');
        Notification::assertSentTo($this->tenant, RentPaymentReceived::class);

        // Income shows straight away; nothing left to confirm.
        $this->actingAs($this->landlordUser)->get('/landlord/finance?range=3')->assertInertia(fn (Assert $p) => $p
            ->has('eft_pending', 0)
            ->where('income_statement.rent_income', 5000));
    }

    #[Test]
    public function landlord_can_reject_an_eft_that_never_arrived(): void
    {
        $this->report();
        $eft = EftPayment::firstOrFail();

        $this->actingAs($this->landlordUser)->post("/landlord/finance/eft/{$eft->id}/reject", ['reason' => 'Not in the account'])->assertRedirect();

        $this->assertSame('rejected', $eft->fresh()->status);
        $this->assertNotSame('paid', $this->nov()->status);
        Notification::assertSentTo($this->tenant, EftPaymentReviewed::class, fn ($n) => $n->eft->status === 'rejected');

        // The tenant can report a new EFT afterwards.
        $this->report(['paid_on' => '2026-11-04'])->assertSessionHasNoErrors();
    }

    #[Test]
    public function a_reported_eft_holds_off_the_debit_order_and_late_penalty(): void
    {
        $this->lease->update(['late_fee_enabled' => true, 'late_fee_type' => 'percent', 'late_fee_value' => 10, 'late_fee_day' => 10, 'late_fee_since' => '2026-11-01']);
        DebitOrder::create([
            'lease_id' => $this->lease->id, 'tenant_id' => $this->tenant->id, 'bank_name' => 'Capitec Bank', 'account_holder' => 'M Parkin',
            'account_number' => '1234567890', 'branch_code' => '470010', 'account_type' => 'savings', 'debit_day' => 5,
            'collect_from' => '2026-11-01', 'status' => 'active', 'signed_at' => now(),
        ]);
        config(['services.paystack.stub' => true, 'services.debit_orders.driver' => 'auto']);

        $this->report(['paid_on' => '2026-11-04']);

        // Debit day arrives: the reported month is not debited.
        $this->at('2026-11-05 08:00');
        $this->assertSame(['succeeded' => 0, 'failed' => 0], app(DebitOrderCollector::class)->run());

        // Penalty cut-off passes while the EFT clears: no penalty (paid on the 4th).
        $this->at('2026-11-12 08:00');
        app(LeaseBillingService::class)->ensureCharges($this->lease);
        $this->assertSame(0.0, (float) $this->nov()->late_fee);
    }

    #[Test]
    public function others_cannot_report_or_review_this_tenants_eft(): void
    {
        $this->report();
        $eft = EftPayment::firstOrFail();

        $other = User::factory()->create(['role' => Role::Landlord, 'status' => UserStatus::Active]);
        $other->assignRole('landlord');
        Landlord::create(['user_id' => $other->id])->activateSubscription('promo', now()->addYear());
        $this->actingAs($other)->post("/landlord/finance/eft/{$eft->id}/confirm")->assertForbidden();
        $this->actingAs($other)->get("/landlord/finance/eft/{$eft->id}/proof")->assertForbidden();

        // A tenant can only report EFTs for their own lease's charges.
        $stranger = User::factory()->create(['role' => Role::Tenant, 'status' => UserStatus::Active]);
        Lease::create([
            'listing_id' => $this->lease->listing_id, 'tenant_id' => $stranger->id, 'landlord_id' => $this->landlordUser->id,
            'start_date' => '2026-11-01', 'end_date' => '2027-10-31', 'monthly_rent' => 100, 'deposit_amount' => 0, 'status' => 'active',
        ]);
        $this->actingAs($stranger)->post('/tenant/payments/eft', [
            'rent_payment_id' => $this->nov()->id, 'amount' => 5000, 'paid_on' => '2026-11-03',
        ])->assertSessionHasErrors('rent_payment_id');
    }
}
