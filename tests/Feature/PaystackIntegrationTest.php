<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\Commission;
use App\Models\Lease;
use App\Models\Listing;
use App\Models\PayoutBatch;
use App\Models\RentPayment;
use App\Models\User;
use App\Notifications\RentPaymentReceived;
use App\Services\PaystackService;
use Carbon\CarbonImmutable;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class PaystackIntegrationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    private function liveMode(): void
    {
        config([
            'services.paystack.secret_key' => 'sk_test_TEST_KEY',
            'services.paystack.base_url'   => 'https://api.paystack.co',
            'services.paystack.stub'       => false,
        ]);
    }

    private function buildLease(): array
    {
        $owner = User::factory()->create(['role' => Role::AgencyAdmin]);
        $agency = Agency::create([
            'user_id' => $owner->id, 'name' => 'Pay Test',
            'slug' => 'pay-' . Str::random(6), 'email' => $owner->email,
            'status' => 'active',
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
            'title' => 'X', 'slug' => 'x-' . Str::random(6),
            'description' => '.', 'listing_type' => 'long_term_rent', 'property_type' => 'apartment',
            'status' => 'leased', 'monthly_rent' => 10000,
            'bedrooms' => 1, 'bathrooms' => 1,
            'suburb' => 'Sandton', 'city' => 'JHB', 'province' => 'Gauteng',
        ]);
        $lease = Lease::create([
            'listing_id' => $listing->id, 'agency_id' => $agency->id, 'agent_id' => $agent->id,
            'tenant_id' => $tenant->id,
            'start_date' => CarbonImmutable::now()->subMonth()->toDateString(),
            'end_date' => CarbonImmutable::now()->addYear()->toDateString(),
            'monthly_rent' => 10_000, 'deposit_amount' => 15_000,
            'deposit_interest_rate' => 6.75, 'escalation_percent' => 8,
            'notice_period_days' => 30, 'status' => 'active',
        ]);
        return compact('agency', 'agent', 'tenant', 'lease', 'listing');
    }

    // ─── Stub mode ──────────────────────────────────────────────────────

    #[Test]
    public function stub_mode_returns_fake_reference_without_network_calls(): void
    {
        config(['services.paystack.stub' => true]);
        Http::preventStrayRequests();

        ['lease' => $lease] = $this->buildLease();
        $init = app(PaystackService::class)->initializePayment($lease, '2026-01');

        $this->assertStringStartsWith('PB_', $init['reference']);
        $this->assertStringContainsString('stub=1', $init['authorization_url']);
        $this->assertDatabaseHas('rent_payments', [
            'lease_id'           => $lease->id,
            'paystack_reference' => $init['reference'],
            'status'             => 'pending',
        ]);
    }

    #[Test]
    public function stub_mode_marks_payment_paid_on_verify(): void
    {
        config(['services.paystack.stub' => true]);

        ['lease' => $lease] = $this->buildLease();
        $init = app(PaystackService::class)->initializePayment($lease, '2026-02');
        $payment = app(PaystackService::class)->verifyTransaction($init['reference']);

        $this->assertNotNull($payment);
        $this->assertEquals('paid', $payment->status);
        $this->assertNotNull($payment->paid_at);
    }

    // ─── Live mode — happy paths ────────────────────────────────────────

    #[Test]
    public function live_mode_calls_paystack_initialize_endpoint(): void
    {
        $this->liveMode();
        Http::fake([
            'api.paystack.co/transaction/initialize' => Http::response([
                'status' => true,
                'message' => 'Authorization URL created',
                'data' => [
                    'authorization_url' => 'https://checkout.paystack.com/abc123',
                    'access_code'       => 'ax_abc123',
                    'reference'         => 'PB_LIVE_TEST_REF_001',
                ],
            ], 200),
        ]);

        ['lease' => $lease] = $this->buildLease();
        $init = app(PaystackService::class)->initializePayment($lease, '2026-03');

        $this->assertEquals('https://checkout.paystack.com/abc123', $init['authorization_url']);
        Http::assertSent(function ($request) use ($lease) {
            $body = $request->data();
            return str_contains($request->url(), '/transaction/initialize')
                && $body['amount'] === 1_000_000              // 10,000 * 100 kobo
                && $body['currency'] === 'ZAR'
                && $body['email'] === $lease->tenant->email;
        });
    }

    #[Test]
    public function live_mode_marks_paid_on_successful_verify(): void
    {
        $this->liveMode();
        Http::fake([
            'api.paystack.co/transaction/initialize' => Http::response([
                'status' => true, 'data' => [
                    'authorization_url' => 'https://x', 'access_code' => 'a', 'reference' => 'LIVE_REF_VERIFY',
                ],
            ], 200),
            'api.paystack.co/transaction/verify/*' => Http::response([
                'status' => true, 'data' => [
                    'status'   => 'success',
                    'channel'  => 'card',
                    'paid_at'  => '2026-03-04T10:00:00Z',
                    'id'       => 999_888,
                ],
            ], 200),
        ]);

        ['lease' => $lease] = $this->buildLease();
        app(PaystackService::class)->initializePayment($lease, '2026-03');
        $payment = app(PaystackService::class)->verifyTransaction('LIVE_REF_VERIFY');

        $this->assertEquals('paid', $payment->status);
        $this->assertEquals('paystack_card', $payment->payment_method);
        $this->assertEquals('999888', $payment->paystack_transaction_id);
    }

    #[Test]
    public function live_mode_leaves_payment_pending_on_unsuccessful_verify(): void
    {
        $this->liveMode();
        Http::fake([
            'api.paystack.co/transaction/initialize' => Http::response([
                'status' => true, 'data' => [
                    'authorization_url' => 'https://x', 'access_code' => 'a', 'reference' => 'LIVE_FAIL_REF',
                ],
            ], 200),
            'api.paystack.co/transaction/verify/*' => Http::response([
                'status' => true, 'data' => ['status' => 'abandoned'],
            ], 200),
        ]);

        ['lease' => $lease] = $this->buildLease();
        app(PaystackService::class)->initializePayment($lease, '2026-04');
        $payment = app(PaystackService::class)->verifyTransaction('LIVE_FAIL_REF');

        // Abandoned/failed leaves payment pending so the tenant can retry.
        $this->assertEquals('pending', $payment->status);
        $this->assertNull($payment->paid_at);
    }

    // ─── Webhook signature ──────────────────────────────────────────────

    #[Test]
    public function webhook_rejects_invalid_signature_in_live_mode(): void
    {
        $this->liveMode();
        $body = json_encode(['event' => 'charge.success', 'data' => ['reference' => 'X']]);

        $resp = $this->call('POST', '/webhooks/paystack', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_X_PAYSTACK_SIGNATURE' => 'this-is-not-the-correct-hmac',
        ], $body);

        $resp->assertStatus(401);
    }

    #[Test]
    public function webhook_accepts_valid_signature_and_marks_payment_paid(): void
    {
        $this->liveMode();
        // Stub the verify endpoint so the webhook handler can call it.
        Http::fake([
            'api.paystack.co/transaction/verify/*' => Http::response([
                'status' => true, 'data' => ['status' => 'success', 'channel' => 'eft', 'paid_at' => '2026-05-01T08:00:00Z', 'id' => 12345],
            ], 200),
        ]);
        Notification::fake();

        ['lease' => $lease, 'tenant' => $tenant] = $this->buildLease();
        $payment = RentPayment::create([
            'lease_id' => $lease->id, 'amount' => 10_000, 'period_month' => '2026-05',
            'due_date' => '2026-05-01', 'paystack_reference' => 'WEBHOOK_REF_1',
            'status' => 'pending',
        ]);

        $body = json_encode([
            'event' => 'charge.success',
            'data'  => ['reference' => 'WEBHOOK_REF_1'],
        ]);
        $sig = hash_hmac('sha512', $body, 'sk_test_TEST_KEY');

        $resp = $this->call('POST', '/webhooks/paystack', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_X_PAYSTACK_SIGNATURE' => $sig,
        ], $body);

        $resp->assertOk();
        $this->assertEquals('paid', $payment->fresh()->status);
        Notification::assertSentTo($tenant, RentPaymentReceived::class);
    }

    // ─── Bulk transfer (commission payout) ──────────────────────────────

    #[Test]
    public function live_mode_bulk_transfer_marks_all_commissions_paid(): void
    {
        $this->liveMode();
        Http::fake([
            'api.paystack.co/transfer/bulk' => Http::response([
                'status' => true, 'data' => ['batch_code' => 'BLK_LIVE_001'],
            ], 200),
        ]);

        ['agency' => $agency, 'agent' => $agent, 'lease' => $lease, 'listing' => $listing] = $this->buildLease();
        $agent->update(['paystack_recipient_code' => 'RCP_LIVE_1']);

        $c1 = Commission::create([
            'agency_id' => $agency->id, 'agent_id' => $agent->id,
            'deal_type' => 'rental', 'listing_id' => $listing->id, 'lease_id' => $lease->id,
            'deal_value' => 120000, 'gross_commission' => 9000,
            'agent_split_percent' => 70, 'agent_amount' => 6300,
            'agency_amount' => 2700, 'vat_amount' => 0, 'agent_net' => 6300,
            'status' => 'approved',
        ]);

        $batch = PayoutBatch::create([
            'agency_id' => $agency->id,
            'batch_date' => now()->toDateString(),
            'total_gross' => 9000, 'total_vat' => 0, 'total_agent_net' => 6300,
            'status' => 'approved',
        ]);
        $c1->update(['payout_batch_id' => $batch->id]);

        app(PaystackService::class)->runPayoutBatch($batch);

        $this->assertEquals('completed', $batch->fresh()->status);
        $this->assertEquals('BLK_LIVE_001', $batch->fresh()->paystack_bulk_transfer_id);
        $this->assertEquals('paid', $c1->fresh()->status);
    }
}
