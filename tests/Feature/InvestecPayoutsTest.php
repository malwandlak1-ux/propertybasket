<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\Commission;
use App\Models\InvestecConnection;
use App\Models\PayoutBatch;
use App\Models\User;
use App\Notifications\CommissionPaid;
use Carbon\CarbonImmutable;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** Agency links its Investec trust account; "Pay via Investec" pays agents' saved beneficiaries directly. */
class InvestecPayoutsTest extends TestCase
{
    use RefreshDatabase;

    private const API = 'https://openapi.investec.com';
    private const KEYS = ['environment' => 'production', 'client_id' => 'cid-123', 'client_secret' => 'sec-456', 'api_key' => 'key-789'];

    private User $owner;
    private User $sipho;
    private User $aisha;
    private Agency $agency;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->owner = User::factory()->create(['role' => Role::AgencyAdmin, 'status' => UserStatus::Active]);
        $this->owner->assignRole('agency_admin');
        $this->agency = Agency::create(['user_id' => $this->owner->id, 'name' => 'Basket Realty', 'slug' => 'br-' . Str::random(6), 'email' => $this->owner->email, 'status' => 'active', 'payout_day' => 25,
            'trust_bank' => 'Investec', 'trust_account_holder' => 'Basket Realty Trust', 'trust_account_number' => '1000 2345 678', 'trust_branch_code' => '580105',
            'trust_account_type' => 'current', 'trust_auditor_name' => 'Shaba Dreams', 'trust_auditor_practice_number' => '904887', 'trust_verified_at' => now()]);
        $this->agency->activateSubscription('promo', now()->addYear());

        $this->sipho = $this->agent('Sipho Dlamini', '1234567890');
        $this->aisha = $this->agent('Aisha Khan', '62000000002');
    }

    private function agent(string $name, ?string $account): User
    {
        $u = User::factory()->create(['name' => $name, 'role' => Role::Agent, 'status' => UserStatus::Active, 'bank_name' => 'Capitec', 'bank_account_holder' => strtoupper($name), 'bank_account_number' => $account, 'bank_code' => '470010']);
        $u->assignRole('agent');
        AgencyAgent::create(['agency_id' => $this->agency->id, 'user_id' => $u->id, 'commission_split_percent' => 50, 'lead_allocation_position' => 0,
            'ffc_number' => 'FFC-' . $u->id, 'ffc_expires_at' => CarbonImmutable::now()->addYear(), 'status' => 'active']);

        return $u;
    }

    private function commission(User $agent, float $net): Commission
    {
        return Commission::create(['agency_id' => $this->agency->id, 'agent_id' => $agent->id, 'deal_type' => 'sale', 'deal_value' => 1_000_000,
            'gross_commission' => $net * 2, 'agent_split_percent' => 50, 'agent_amount' => $net, 'agency_amount' => $net, 'vat_amount' => 0, 'agent_net' => $net, 'status' => 'approved']);
    }

    /** @param array<string, mixed> $pay response for paymultiple */
    private function fakeInvestec(mixed $pay = null, ?array $beneficiaries = null): void
    {
        Http::fake([
            self::API . '/identity/v2/oauth2/token' => Http::response(['access_token' => 'tok', 'token_type' => 'Bearer', 'expires_in' => 1799]),
            self::API . '/za/pb/v1/accounts' => Http::response(['data' => ['accounts' => [
                ['accountId' => 'ACC-OPS', 'accountNumber' => '10009999999', 'accountName' => 'Basket Realty Ops', 'productName' => 'Private Bank Account'],
                ['accountId' => 'ACC-TRUST', 'accountNumber' => '10002345678', 'accountName' => 'Basket Realty Trust', 'productName' => 'Private Bank Account'],
            ]]]),
            self::API . '/za/pb/v1/accounts/beneficiaries' => Http::response(['data' => $beneficiaries ?? [
                ['beneficiaryId' => 'BEN-S', 'accountNumber' => '1234567890', 'code' => '470010', 'bank' => 'Capitec', 'beneficiaryName' => 'S Dlamini'],
                ['beneficiaryId' => 'BEN-A', 'accountNumber' => '62000000002', 'code' => '250655', 'bank' => 'FNB', 'beneficiaryName' => 'A Khan'],
            ]]),
            self::API . '/za/pb/v1/accounts/ACC-TRUST/paymultiple' => $pay ?? Http::response(['data' => ['TransferResponses' => [
                ['PaymentReferenceNumber' => 'INV-REF-1', 'PaymentDate' => '11/09/2026', 'Status' => '- Payment effective date 11/09/2026', 'BeneficiaryName' => 'S Dlamini', 'BeneficiaryAccountId' => 'BEN-S', 'AuthorisationRequired' => false],
                ['PaymentReferenceNumber' => 'INV-REF-2', 'PaymentDate' => '11/09/2026', 'Status' => '- Payment effective date 11/09/2026', 'BeneficiaryName' => 'A Khan', 'BeneficiaryAccountId' => 'BEN-A', 'AuthorisationRequired' => false],
            ], 'ErrorMessage' => null]]),
        ]);
    }

    private function connect(): void
    {
        $this->actingAs($this->owner)->post('/agency/payouts/investec', self::KEYS)->assertSessionHas('success');
        $this->agency->update(['payout_method' => 'investec']);
    }

    #[Test]
    public function linking_picks_the_trust_account_and_keeps_the_keys_encrypted(): void
    {
        $this->fakeInvestec();

        $this->actingAs($this->owner)->post('/agency/payouts/investec', self::KEYS)->assertSessionHas('success');

        $c = InvestecConnection::firstOrFail();
        $this->assertSame(['ACC-TRUST', '10002345678'], [$c->account_id, $c->account_number], 'The account matching the verified trust account, not the operating account');
        $this->assertSame('sec-456', $c->client_secret);
        $raw = DB::table('investec_connections')->first();
        $this->assertNotSame('sec-456', $raw->client_secret);
        $this->assertStringNotContainsString('key-789', json_encode($raw));
        Http::assertSent(fn ($r) => str_ends_with($r->url(), '/identity/v2/oauth2/token')
            && $r->hasHeader('x-api-key', 'key-789') && $r->hasHeader('Authorization', 'Basic ' . base64_encode('cid-123:sec-456'))
            && $r['grant_type'] === 'client_credentials' && str_contains($r['scope'], 'beneficiarypayments'));

        $this->actingAs($this->owner)->patch('/agency/settings', ['vat_registered' => 0, 'vat_rate' => 15, 'payout_day' => 25, 'payout_method' => 'investec'])->assertSessionHasNoErrors();
        $this->actingAs($this->owner)->get('/agency/settings')->assertOk()
            ->assertInertia(fn (Assert $p) => $p->where('agency.payout_method', 'investec')->where('agency.investec.account', '•••• 5678')->where('agency.investec.problem', null)
                ->missing('agency.investec.client_secret'));
    }

    #[Test]
    public function linking_refuses_keys_without_the_trust_account_or_with_bad_credentials(): void
    {
        $this->fakeInvestec();
        $this->agency->update(['trust_account_number' => '55500011122']);
        $this->actingAs($this->owner)->post('/agency/payouts/investec', self::KEYS)
            ->assertSessionHas('error', fn ($m) => str_contains($m, '•••• 1122') && str_contains($m, '•••• 5678'));
        $this->assertSame(0, InvestecConnection::count());

        Http::swap(new \Illuminate\Http\Client\Factory); // fresh fakes: Investec now rejects the keys
        Http::fake([self::API . '/identity/v2/oauth2/token' => Http::response(['error' => 'invalid_client'], 401)]);
        $this->agency->update(['trust_account_number' => '10002345678']);
        $this->actingAs($this->owner)->post('/agency/payouts/investec', ['client_id' => 'other'] + self::KEYS)
            ->assertSessionHas('error', fn ($m) => str_contains($m, 'didn’t accept these API credentials'));
        $this->assertSame(0, InvestecConnection::count());

        // Can't pick Investec as the payout method without a link.
        $this->actingAs($this->owner)->patch('/agency/settings', ['vat_registered' => 0, 'vat_rate' => 15, 'payout_day' => 25, 'payout_method' => 'investec'])->assertSessionHasErrors('payout_method');
    }

    #[Test]
    public function one_click_pays_every_agent_from_the_trust_account(): void
    {
        Notification::fake();
        $this->fakeInvestec();
        $this->connect();
        $this->commission($this->sipho, 12_500);
        $this->commission($this->sipho, 2_500);
        $this->commission($this->aisha, 8_000.5);

        $this->actingAs($this->owner)->post('/agency/commissions/payout')->assertSessionHas('success', fn ($m) => str_contains($m, 'Investec'));

        Http::assertSent(fn ($r) => str_ends_with($r->url(), '/accounts/ACC-TRUST/paymultiple')
            && $r->hasHeader('Authorization', 'Bearer tok')
            && count($r['paymentList']) === 2
            && collect($r['paymentList'])->firstWhere('beneficiaryId', 'BEN-S')['amount'] === '15000.00'
            && collect($r['paymentList'])->firstWhere('beneficiaryId', 'BEN-A')['amount'] === '8000.50'
            && collect($r['paymentList'])->every(fn ($p) => mb_strlen($p['myReference']) <= 20 && mb_strlen($p['theirReference']) <= 20));

        $batch = PayoutBatch::firstOrFail();
        $this->assertSame(['completed', 'investec'], [$batch->status, $batch->method]);
        $this->assertSame(3, Commission::where('status', 'paid')->count());
        $this->assertSame(['INV-REF-1'], Commission::where('agent_id', $this->sipho->id)->pluck('payment_reference')->unique()->values()->all());
        Notification::assertSentTo($this->sipho, CommissionPaid::class, fn ($n) => str_contains(implode(' ', $n->toMail($this->sipho)->introLines), 'Investec'));
        Notification::assertSentTo($this->aisha, CommissionPaid::class);
    }

    #[Test]
    public function an_agent_who_isnt_an_investec_beneficiary_stops_the_run_before_any_money_moves(): void
    {
        $this->fakeInvestec(beneficiaries: [['beneficiaryId' => 'BEN-S', 'accountNumber' => '1234567890', 'beneficiaryName' => 'S Dlamini']]);
        $this->connect();
        $this->commission($this->sipho, 5_000);
        $this->commission($this->aisha, 5_000);

        $this->actingAs($this->owner)->post('/agency/commissions/payout')
            ->assertSessionHas('error', fn ($m) => str_contains($m, 'Aisha Khan') && str_contains($m, 'beneficiary'));
        Http::assertNotSent(fn ($r) => str_contains($r->url(), 'paymultiple'));
        $this->assertSame(0, Commission::where('status', 'paid')->count());
        $this->assertFalse(PayoutBatch::whereIn('status', ['processing', 'failed'])->exists());

        // The settings check shows who's missing.
        $this->actingAs($this->owner)->getJson('/agency/payouts/investec/agents')->assertOk()
            ->assertJsonPath('agents', fn ($rows) => collect($rows)->firstWhere('agent', 'Aisha Khan')['beneficiary_id'] === null
                && collect($rows)->firstWhere('agent', 'Sipho Dlamini')['beneficiary'] === 'S Dlamini');
    }

    #[Test]
    public function payments_needing_approval_wait_until_the_agency_marks_them_paid(): void
    {
        Notification::fake();
        $this->fakeInvestec(Http::response(['data' => ['TransferResponses' => [
            ['PaymentReferenceNumber' => 'INV-9', 'PaymentDate' => '11/09/2026', 'Status' => 'Pending authorisation', 'BeneficiaryName' => 'S Dlamini', 'BeneficiaryAccountId' => 'BEN-S', 'AuthorisationRequired' => true],
        ]]]));
        $this->connect();
        $this->commission($this->sipho, 4_000);

        $this->actingAs($this->owner)->post('/agency/commissions/payout')->assertSessionHas('success', fn ($m) => str_contains($m, 'approval'));
        $batch = PayoutBatch::firstOrFail();
        $this->assertSame('processing', $batch->status);
        $this->assertSame('approved', Commission::first()->status);
        Notification::assertNothingSent();

        $this->actingAs($this->owner)->get('/agency/commissions')->assertInertia(fn (Assert $p) => $p->where('eft_batch.method', 'investec')->where('eft_batch.status', 'processing')->where('eft_batch.file_url', null));
        // A second click can't pay again while it's waiting.
        $this->actingAs($this->owner)->post('/agency/commissions/payout')->assertSessionHas('error');
        Http::assertSentCount(4); // token, accounts (link), beneficiaries, one paymultiple

        $this->actingAs($this->owner)->post("/agency/commissions/batches/{$batch->id}/paid")->assertSessionHas('success');
        $this->assertSame('paid', Commission::first()->status);
        Notification::assertSentTo($this->sipho, CommissionPaid::class);
    }

    #[Test]
    public function a_failed_payment_is_recorded_and_can_be_released_to_try_again(): void
    {
        $this->fakeInvestec(Http::response(['data' => ['ErrorMessage' => 'Daily limit exceeded']], 400));
        $this->connect();
        $c = $this->commission($this->sipho, 50_000);

        $this->actingAs($this->owner)->post('/agency/commissions/payout')->assertSessionHas('error', fn ($m) => str_contains($m, 'Daily limit exceeded'));
        $batch = PayoutBatch::firstOrFail();
        $this->assertSame('failed', $batch->status);
        $this->assertSame('approved', $c->fresh()->status);

        $this->actingAs($this->owner)->get('/agency/commissions')->assertInertia(fn (Assert $p) => $p->where('eft_batch.status', 'failed')->where('eft_batch.failure', fn ($f) => str_contains($f, 'Daily limit')));

        $this->actingAs($this->owner)->post("/agency/commissions/batches/{$batch->id}/release")->assertSessionHas('success');
        $this->assertNull($c->fresh()->payout_batch_id);
        $this->actingAs($this->owner)->get('/agency/commissions')->assertInertia(fn (Assert $p) => $p->where('eft_batch', null));
    }

    #[Test]
    public function a_changed_trust_account_blocks_investec_payouts_until_relinked(): void
    {
        $this->fakeInvestec();
        $this->connect();
        $this->commission($this->sipho, 1_000);
        $this->agency->update(['trust_account_number' => '77700000001']);

        $this->actingAs($this->owner)->post('/agency/commissions/payout')->assertSessionHas('error', fn ($m) => str_contains($m, 'not your verified trust account'));
        Http::assertNotSent(fn ($r) => str_contains($r->url(), 'paymultiple'));

        // Disconnecting removes the keys and falls back to the EFT file.
        $this->actingAs($this->owner)->delete('/agency/payouts/investec')->assertSessionHas('success');
        $this->assertSame(0, InvestecConnection::count());
        $this->assertSame('trust_account', $this->agency->fresh()->payout_method);
    }
}
