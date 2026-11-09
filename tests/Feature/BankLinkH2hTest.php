<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\BankFile;
use App\Models\BankLink;
use App\Models\Commission;
use App\Models\PayoutBatch;
use App\Models\User;
use App\Notifications\BankLinkRequested;
use App\Notifications\BankLinkStatusChanged;
use App\Notifications\CommissionPaid;
use App\Services\Banking\H2H\BankProfile;
use App\Services\Banking\H2H\Iso20022;
use App\Services\Banking\H2H\Transport;
use App\Services\Banking\H2H\TransportFactory;
use Carbon\CarbonImmutable;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** FNB host-to-host: request → onboarding stages → pain.001 out → pain.002 back → commissions settled. */
class BankLinkH2hTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $admin;
    private User $sipho;
    private User $aisha;
    private Agency $agency;
    private FakeBankServer $bank;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        Storage::fake('local');

        $this->owner = User::factory()->create(['role' => Role::AgencyAdmin, 'status' => UserStatus::Active]);
        $this->owner->assignRole('agency_admin');
        $this->admin = User::factory()->create(['role' => Role::SuperAdmin, 'status' => UserStatus::Active]);
        $this->admin->assignRole('super_admin');
        $this->agency = Agency::create(['user_id' => $this->owner->id, 'name' => 'Basket Realty (Pty) Ltd', 'slug' => 'br-' . Str::random(6), 'email' => $this->owner->email, 'status' => 'active', 'payout_day' => 25,
            'trust_bank' => 'First National Bank (FNB)', 'trust_account_holder' => 'Basket Realty Trust', 'trust_account_number' => '6322 4695 940', 'trust_branch_code' => '250655',
            'trust_account_type' => 'current', 'trust_auditor_name' => 'Shaba Dreams', 'trust_auditor_practice_number' => '904887', 'trust_verified_at' => now()]);
        $this->agency->activateSubscription('promo', now()->addYear());

        $this->sipho = $this->agent('Sipho Dlamini', '1234567890', '470010');
        $this->aisha = $this->agent('Aïsha Khan-O\'Neil', '62000000002', '250655');

        $this->bank = new FakeBankServer();
        $this->app->instance(TransportFactory::class, new class($this->bank) extends TransportFactory {
            public function __construct(private FakeBankServer $server) {}

            public function for(BankLink $link): Transport
            {
                return $this->server;
            }
        });
    }

    private function agent(string $name, string $account, string $branch): User
    {
        $u = User::factory()->create(['name' => $name, 'role' => Role::Agent, 'status' => UserStatus::Active, 'bank_name' => 'Bank', 'bank_account_holder' => $name, 'bank_account_number' => $account, 'bank_code' => $branch]);
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

    private function liveLink(string $status = 'live'): BankLink
    {
        $link = BankLink::create(['agency_id' => $this->agency->id, 'bank' => 'fnb', 'status' => $status, 'client_code' => 'PB0001',
            'sftp_host' => 'h2h.example.test', 'sftp_username' => 'basket', 'sftp_private_key' => 'KEY', 'requested_at' => now(), 'live_at' => now()]);
        $this->agency->update(['payout_method' => 'bank_h2h']);

        return $link;
    }

    private function statusReport(string $msgId, ?string $groupStatus, array $txs): string
    {
        $rows = collect($txs)->map(fn ($st, $e2e) => '<TxInfAndSts><OrgnlEndToEndId>' . $e2e . '</OrgnlEndToEndId><TxSts>' . $st[0] . '</TxSts>'
            . (isset($st[1]) ? '<StsRsnInf><Rsn><Cd>' . $st[1] . '</Cd></Rsn><AddtlInf>' . ($st[2] ?? '') . '</AddtlInf></StsRsnInf>' : '') . '</TxInfAndSts>')->implode('');

        return '<?xml version="1.0" encoding="UTF-8"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.002.001.03"><CstmrPmtStsRpt>'
            . '<GrpHdr><MsgId>FNB-STS-1</MsgId><CreDtTm>2026-11-09T10:00:00</CreDtTm></GrpHdr>'
            . '<OrgnlGrpInfAndSts><OrgnlMsgId>' . $msgId . '</OrgnlMsgId><OrgnlMsgNmId>pain.001.001.03</OrgnlMsgNmId>' . ($groupStatus ? "<GrpSts>{$groupStatus}</GrpSts>" : '') . '</OrgnlGrpInfAndSts>'
            . '<OrgnlPmtInfAndSts><OrgnlPmtInfId>PB1</OrgnlPmtInfId>' . $rows . '</OrgnlPmtInfAndSts></CstmrPmtStsRpt></Document>';
    }

    #[Test]
    public function an_agency_requests_a_link_and_admins_take_it_through_the_stages(): void
    {
        Notification::fake();
        $this->actingAs($this->owner)->post('/agency/payouts/bank-link', ['bank' => 'fnb', 'contact_name' => 'Lerato M', 'contact_email' => 'lerato@basket.test', 'banker_name' => 'Thabo (FNB)'])
            ->assertSessionHas('success');
        $link = BankLink::firstOrFail();
        $this->assertSame('requested', $link->status);
        Notification::assertSentTo($this->admin, BankLinkRequested::class);
        $this->actingAs($this->owner)->post('/agency/payouts/bank-link', ['bank' => 'fnb', 'contact_name' => 'X', 'contact_email' => 'x@x.test'])->assertSessionHas('error');

        // Not usable until live/testing with connection details.
        $this->actingAs($this->owner)->patch('/agency/settings', ['vat_registered' => 0, 'vat_rate' => 15, 'payout_day' => 25, 'payout_method' => 'bank_h2h'])->assertSessionHasErrors('payout_method');
        $this->actingAs($this->owner)->get('/agency/settings')->assertInertia(fn (Assert $p) => $p->where('agency.bank_link.status', 'requested')->where('agency.bank_link.bank_name', 'FNB'));

        // Admin only.
        $this->actingAs($this->owner)->patch("/admin/bank-links/{$link->id}", ['status' => 'live'])->assertForbidden();
        $this->actingAs($this->admin)->get('/admin/bank-links')->assertOk()->assertInertia(fn (Assert $p) => $p->component('Admin/BankLinks')->where('links.0.status', 'requested'));

        // Can't go to testing without connection details.
        $this->actingAs($this->admin)->patch("/admin/bank-links/{$link->id}", ['status' => 'testing'])->assertSessionHas('error');
        $this->assertSame('requested', $link->fresh()->status);

        $this->actingAs($this->admin)->patch("/admin/bank-links/{$link->id}", ['status' => 'testing', 'sftp_host' => 'h2h-uat.fnb.test', 'sftp_username' => 'basket', 'sftp_private_key' => "-----BEGIN KEY-----\nabc\n-----END KEY-----", 'client_code' => 'PB0001'])
            ->assertSessionHas('success');
        $link->refresh();
        $this->assertSame('testing', $link->status);
        $this->assertStringContainsString('BEGIN KEY', $link->sftp_private_key);
        $this->assertStringNotContainsString('BEGIN KEY', (string) DB::table('bank_links')->value('sftp_private_key'), 'Key stored encrypted');
        Notification::assertSentTo($this->owner, BankLinkStatusChanged::class, fn ($n) => $n->link->status === 'testing');

        // Saving again without retyping the key keeps it.
        $this->actingAs($this->admin)->patch("/admin/bank-links/{$link->id}", ['status' => 'live', 'sftp_host' => 'h2h.fnb.test', 'sftp_username' => 'basket']);
        $this->assertSame(['live', true], [$link->fresh()->status, filled($link->fresh()->sftp_private_key)]);

        $this->actingAs($this->owner)->patch('/agency/settings', ['vat_registered' => 0, 'vat_rate' => 15, 'payout_day' => 25, 'payout_method' => 'bank_h2h'])->assertSessionHasNoErrors();
        $this->assertSame('bank_h2h', $this->agency->fresh()->payout_method);
    }

    #[Test]
    public function the_payment_file_is_a_valid_pain_001_from_the_trust_account(): void
    {
        $xml = app(Iso20022::class)->creditTransfer(BankProfile::for('fnb'), [
            'message_id' => 'PB1-7-261109101500', 'payment_info_id' => 'PB7', 'created_at' => now(), 'execution_date' => now(),
            'initiator_name' => 'Basket Realty (Pty) Ltd', 'initiator_id' => 'PB0001', 'debtor_name' => 'Basket Realty Trust', 'debtor_account' => '6322 4695 940',
        ], [
            ['end_to_end_id' => 'PB7A2', 'amount' => 15000, 'name' => 'Sipho Dlamini', 'account' => '1234567890', 'branch_code' => '470010', 'reference' => 'COMMISSION NOV 2026'],
            ['end_to_end_id' => 'PB7A3', 'amount' => 8000.5, 'name' => 'Aïsha Khan-O\'Neil & Co', 'account' => '62000000002', 'branch_code' => '250655', 'reference' => 'COMMISSION NOV 2026'],
        ]);

        $doc = new \DOMDocument();
        $this->assertTrue($doc->loadXML($xml));
        $x = new \DOMXPath($doc);
        $x->registerNamespace('p', 'urn:iso:std:iso:20022:tech:xsd:pain.001.001.03');
        $v = fn ($q) => $x->evaluate("string({$q})");
        $this->assertSame('2', $v('//p:GrpHdr/p:NbOfTxs'));
        $this->assertSame('23000.50', $v('//p:GrpHdr/p:CtrlSum'));
        $this->assertSame('23000.50', $v('//p:PmtInf/p:CtrlSum'));
        $this->assertSame('PB0001', $v('//p:InitgPty/p:Id/p:OrgId/p:Othr/p:Id'));
        $this->assertSame('63224695940', $v('//p:DbtrAcct/p:Id/p:Othr/p:Id'));
        $this->assertSame('FIRNZAJJ', $v('//p:DbtrAgt/p:FinInstnId/p:BIC'));
        $this->assertSame('8000.50', $v("//p:CdtTrfTxInf[p:PmtId/p:EndToEndId='PB7A3']/p:Amt/p:InstdAmt"));
        $this->assertSame('ZAR', $v("//p:CdtTrfTxInf[p:PmtId/p:EndToEndId='PB7A3']/p:Amt/p:InstdAmt/@Ccy"));
        $this->assertSame('ZANCC', $v("//p:CdtTrfTxInf[p:PmtId/p:EndToEndId='PB7A3']//p:ClrSysId/p:Cd"));
        $this->assertSame('250655', $v("//p:CdtTrfTxInf[p:PmtId/p:EndToEndId='PB7A3']//p:MmbId"));
        $this->assertSame("Aisha Khan-O'Neil Co", $v("//p:CdtTrfTxInf[p:PmtId/p:EndToEndId='PB7A3']/p:Cdtr/p:Nm"), 'SWIFT character set only');
        $this->assertSame('62000000002', $v("//p:CdtTrfTxInf[p:PmtId/p:EndToEndId='PB7A3']/p:CdtrAcct/p:Id/p:Othr/p:Id"));
        // Elements in schema order inside a transaction.
        $order = array_map(fn ($n) => $n->localName, iterator_to_array($x->query("//p:CdtTrfTxInf[1]/*")));
        $this->assertSame(['PmtId', 'Amt', 'CdtrAgt', 'Cdtr', 'CdtrAcct', 'RmtInf'], $order);
    }

    #[Test]
    public function run_payout_sends_the_file_and_status_reports_settle_it(): void
    {
        Notification::fake();
        $this->liveLink();
        $this->commission($this->sipho, 12_500);
        $this->commission($this->sipho, 2_500);
        $this->commission($this->aisha, 8_000);

        $this->actingAs($this->owner)->post('/agency/commissions/payout')->assertSessionHas('success', fn ($m) => str_contains($m, 'sent to FNB'));
        $this->assertCount(1, $this->bank->uploaded);
        $name = array_key_first($this->bank->uploaded);
        $this->assertStringStartsWith("PB_{$this->agency->id}_", $name);
        $this->assertStringContainsString('<EndToEndId>PB', $this->bank->uploaded[$name]);

        $batch = PayoutBatch::firstOrFail();
        $this->assertSame(['processing', 'bank_h2h'], [$batch->status, $batch->method]);
        $this->assertSame(3, Commission::where('status', 'approved')->where('bank_status', 'SENT')->count(), 'Not paid until the bank confirms');
        $out = BankFile::where('direction', 'out')->firstOrFail();
        Storage::disk('local')->assertExists($out->storage_path);
        Notification::assertNothingSent();

        // A second click can't send a second file.
        $this->actingAs($this->owner)->post('/agency/commissions/payout')->assertSessionHas('error');
        $this->assertCount(1, $this->bank->uploaded);

        // FNB: Sipho settled, Aisha rejected (closed account).
        $this->bank->inbox['STS_1.xml'] = $this->statusReport($batch->bank_message_id, 'PART', [
            "PB{$batch->id}A{$this->sipho->id}" => ['ACSP'],
            "PB{$batch->id}A{$this->aisha->id}" => ['RJCT', 'AC04', 'Account closed'],
        ]);
        $this->artisan('bank:poll')->assertSuccessful();

        $this->assertSame(2, Commission::where('agent_id', $this->sipho->id)->where('status', 'paid')->count());
        Notification::assertSentTo($this->sipho, CommissionPaid::class, fn ($n) => $n->commissions->count() === 2);
        Notification::assertNotSentTo($this->aisha, CommissionPaid::class);
        $batch->refresh();
        $this->assertSame('failed', $batch->status);
        $this->assertStringContainsString('Account closed', $batch->failure_reason);
        $this->assertStringContainsString('Khan', $batch->failure_reason);
        $this->assertSame(1, BankFile::where('direction', 'in')->count());

        // Same file isn't processed twice.
        $this->artisan('bank:poll')->assertSuccessful();
        $this->assertSame(1, BankFile::where('direction', 'in')->count());

        $this->actingAs($this->owner)->get('/agency/commissions')->assertInertia(fn (Assert $p) => $p->where('eft_batch.method', 'bank_h2h')->where('eft_batch.status', 'failed')->where('eft_batch.paid_count', 2));

        // Fix Aisha's details, release, pay again in a new file.
        $this->actingAs($this->owner)->post("/agency/commissions/batches/{$batch->id}/release")->assertSessionHas('success');
        $this->assertSame('completed', $batch->fresh()->status, 'Some commissions went through, so the batch is closed');
        $this->actingAs($this->owner)->post('/agency/commissions/payout')->assertSessionHas('success');
        $this->assertCount(2, $this->bank->uploaded);
        $second = PayoutBatch::latest('id')->firstOrFail();
        $this->bank->inbox['STS_2.xml'] = $this->statusReport($second->bank_message_id, 'ACSC', ["PB{$second->id}A{$this->aisha->id}" => ['ACSC']]);
        $this->artisan('bank:poll')->assertSuccessful();
        $this->assertSame('completed', $second->fresh()->status);
        $this->assertSame(0, Commission::where('status', 'approved')->count());
    }

    #[Test]
    public function a_whole_file_rejected_by_the_bank_is_reported(): void
    {
        $this->liveLink();
        $this->commission($this->sipho, 1_000);
        $this->actingAs($this->owner)->post('/agency/commissions/payout');
        $batch = PayoutBatch::firstOrFail();

        $this->bank->inbox['REJ.xml'] = $this->statusReport($batch->bank_message_id, 'RJCT', []);
        $this->bank->inbox['README.txt'] = 'not xml';
        $this->artisan('bank:poll')->assertSuccessful();

        $this->assertSame('failed', $batch->fresh()->status);
        $this->assertSame('approved', Commission::first()->status);
        $this->assertSame(2, BankFile::where('direction', 'in')->count(), 'Unknown files are kept for reference too');
    }

    #[Test]
    public function nothing_is_sent_when_the_link_or_trust_account_isnt_right(): void
    {
        $link = $this->liveLink('credentials');
        $this->commission($this->sipho, 1_000);
        $this->actingAs($this->owner)->post('/agency/commissions/payout')->assertSessionHas('error', fn ($m) => str_contains($m, 'isn’t set up yet'));

        $link->update(['status' => 'live']);
        $this->agency->update(['trust_bank' => 'Standard Bank']);
        $this->actingAs($this->owner)->post('/agency/commissions/payout')->assertSessionHas('error', fn ($m) => str_contains($m, 'isn’t at FNB'));

        $this->agency->update(['trust_bank' => 'FNB']);
        $this->sipho->update(['bank_code' => null]);
        $this->actingAs($this->owner)->post('/agency/commissions/payout')->assertSessionHas('error', fn ($m) => str_contains($m, 'Sipho Dlamini'));

        $this->assertSame([], $this->bank->uploaded);
        $this->assertFalse(PayoutBatch::where('status', 'processing')->exists());
    }

    #[Test]
    public function an_upload_failure_leaves_the_batch_ready_to_retry(): void
    {
        $this->liveLink();
        $this->commission($this->sipho, 1_000);
        $this->bank->failUploads = true;

        $this->actingAs($this->owner)->post('/agency/commissions/payout')->assertSessionHas('error', fn ($m) => str_contains($m, 'refused'));
        $batch = PayoutBatch::firstOrFail();
        $this->assertSame('pending', $batch->status);
        $this->assertNull($batch->method);

        $this->bank->failUploads = false;
        $this->actingAs($this->owner)->post('/agency/commissions/payout')->assertSessionHas('success');
        $this->assertSame('processing', $batch->fresh()->status);
    }
}

/** In-memory stand-in for the bank's SFTP server. */
class FakeBankServer implements Transport
{
    public array $uploaded = [];
    public array $inbox = [];
    public bool $failUploads = false;

    public function put(string $name, string $contents): void
    {
        if ($this->failUploads) {
            throw new \App\Services\Banking\H2H\BankLinkException('The bank’s server refused the login (check the username and key).');
        }
        $this->uploaded[$name] = $contents;
    }

    public function list(): array
    {
        return array_keys($this->inbox);
    }

    public function get(string $name): string
    {
        return $this->inbox[$name];
    }
}
