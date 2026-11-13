<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\PlatformTransaction;
use App\Models\User;
use App\Support\PlatformPlans;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** Monthly / yearly billing: yearly is paid upfront at a 20% discount and runs 12 months. */
class YearlyBillingTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Agency $agency;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->owner = User::factory()->create(['role' => Role::AgencyAdmin, 'status' => UserStatus::Active]);
        $this->owner->assignRole('agency_admin');
        $this->agency = Agency::create(['user_id' => $this->owner->id, 'name' => 'Basket Realty', 'slug' => 'br-' . Str::random(6), 'email' => $this->owner->email, 'status' => 'active']);
        $this->agency->activateSubscription('starter', now()->addDays(10));
    }

    #[Test]
    public function yearly_prices_are_twenty_percent_off_twelve_months(): void
    {
        $this->assertSame(20, PlatformPlans::YEARLY_DISCOUNT_PERCENT);
        $this->assertSame(12470, PlatformPlans::yearlyTotal(1299)); // 1299 × 12 × 0.8 = 12 470.4
        $this->assertSame(1039, PlatformPlans::yearlyMonthly(1299));

        $this->actingAs($this->owner)->get('/agency/billing')->assertOk()->assertInertia(fn (Assert $p) => $p
            ->where('yearly_discount', 20)
            ->where('current.period', 'monthly')
            ->where('plans', fn ($plans) => collect($plans)->contains(fn ($pl) => $pl['key'] === 'growth' && $pl['yearly_total'] === 12470 && $pl['yearly_monthly'] === 1039)));
    }

    #[Test]
    public function a_yearly_plan_is_charged_upfront_and_runs_twelve_months(): void
    {
        config(['services.paystack.secret_key' => '', 'services.paystack.stub' => true]);
        $this->actingAs($this->owner)->post('/billing/checkout', ['plan_key' => 'growth', 'period' => 'yearly']);

        $txn = PlatformTransaction::firstOrFail();
        $this->assertSame('growth:yearly', $txn->description);
        $this->assertEquals(PlatformPlans::yearlyTotal(PlatformPlans::priceFor('growth')), (float) $txn->amount);

        $before = $this->agency->fresh()->subscription_expires_at;
        $this->actingAs($this->owner)->get("/billing/callback?reference={$txn->paystack_reference}")->assertRedirect();
        $agency = $this->agency->fresh();
        $this->assertSame('growth', $agency->subscription_plan);
        // Extends from the current renewal date, so the 10 days already paid aren't lost.
        $this->assertTrue($agency->subscription_expires_at->isSameDay($before->copy()->addYear()));

        $this->actingAs($this->owner)->get('/agency/billing')->assertInertia(fn (Assert $p) => $p->where('current.period', 'yearly'));
    }

    #[Test]
    public function a_stub_query_param_cannot_mark_a_live_payment_paid(): void
    {
        config(['services.paystack.secret_key' => 'sk_test_X', 'services.paystack.stub' => false]);
        Http::fake([
            'api.paystack.co/transaction/initialize' => Http::response(['status' => true, 'data' => ['authorization_url' => 'https://checkout.paystack.com/x', 'access_code' => 'a', 'reference' => 'R1']]),
            'api.paystack.co/transaction/verify/*' => Http::response(['status' => true, 'data' => ['status' => 'abandoned']]),
        ]);
        $this->actingAs($this->owner)->post('/billing/checkout', ['plan_key' => 'enterprise', 'period' => 'yearly']);
        $txn = PlatformTransaction::firstOrFail();

        $this->actingAs($this->owner)->get("/billing/callback?reference={$txn->paystack_reference}&stub=1")->assertRedirect('/billing/select');
        $this->assertSame('failed', $txn->fresh()->status);
        $this->assertSame('starter', $this->agency->fresh()->subscription_plan);
    }

    #[Test]
    public function the_chosen_payment_method_is_the_only_one_paystack_shows(): void
    {
        config(['services.paystack.secret_key' => 'sk_test_X', 'services.paystack.stub' => false,
            'services.paystack.subscription_channels' => ['card', 'eft', 'capitec_pay']]);
        Http::fake([
            'api.paystack.co/transaction/initialize' => Http::response(['status' => true, 'data' => ['authorization_url' => 'https://checkout.paystack.com/x', 'access_code' => 'a', 'reference' => 'R1']]),
        ]);

        $this->actingAs($this->owner)->get('/agency/billing')->assertInertia(fn (Assert $p) => $p->where('payment_methods', ['card', 'eft', 'capitec_pay']));

        // Monthly is charged too, through the method picked.
        $this->actingAs($this->owner)->post('/billing/checkout', ['plan_key' => 'growth', 'period' => 'monthly', 'channel' => 'eft'])
            ->assertRedirect('https://checkout.paystack.com/x');
        Http::assertSent(fn ($r) => str_ends_with($r->url(), '/transaction/initialize') && $r['channels'] === ['eft']
            && $r['amount'] === PlatformPlans::priceFor('growth') * 100);
        $this->assertSame('growth', PlatformTransaction::firstOrFail()->description);

        // A method that isn't offered is refused before anything reaches Paystack.
        $this->actingAs($this->owner)->post('/billing/checkout', ['plan_key' => 'growth', 'period' => 'yearly', 'channel' => 'ussd'])
            ->assertSessionHasErrors('channel');
        $this->assertSame(1, PlatformTransaction::count());
    }

    #[Test]
    public function a_failed_paystack_start_comes_back_with_a_message(): void
    {
        config(['services.paystack.secret_key' => 'sk_test_X', 'services.paystack.stub' => false]);
        Http::fake(['api.paystack.co/transaction/initialize' => Http::response(['status' => false, 'message' => 'Channel not enabled'], 400)]);

        $this->actingAs($this->owner)->from('/agency/billing')->post('/billing/checkout', ['plan_key' => 'growth', 'period' => 'yearly', 'channel' => 'apple_pay'])
            ->assertRedirect('/agency/billing')->assertSessionHas('error');
        $this->assertSame('starter', $this->agency->fresh()->subscription_plan);
    }
}
