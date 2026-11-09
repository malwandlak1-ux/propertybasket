<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\Commission;
use App\Models\PayoutBatch;
use App\Models\User;
use App\Notifications\CommissionPaid;
use Carbon\CarbonImmutable;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** An agency pays agents' commission via Paystack or by EFT from its verified trust account. */
class AgencyPayoutMethodTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $agent;
    private User $agent2;
    private Agency $agency;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        config(['services.paystack.stub' => true]);

        $this->owner = User::factory()->create(['role' => Role::AgencyAdmin, 'status' => UserStatus::Active]);
        $this->owner->assignRole('agency_admin');
        $this->agency = Agency::create(['user_id' => $this->owner->id, 'name' => 'Basket Realty', 'slug' => 'br-' . Str::random(6), 'email' => $this->owner->email, 'status' => 'active', 'payout_day' => 25]);
        $this->agency->activateSubscription('promo', now()->addYear());

        $this->agent = $this->makeAgent(['name' => 'Sipho Dlamini', 'bank_name' => 'Capitec', 'bank_account_holder' => 'S DLAMINI', 'bank_account_number' => '1234567890', 'bank_code' => '470010', 'bank_account_type' => 'savings']);
        $this->agent2 = $this->makeAgent(['name' => 'Aisha Khan', 'bank_name' => 'FNB', 'bank_account_holder' => 'A KHAN', 'bank_account_number' => '62000000002', 'bank_code' => '250655', 'bank_account_type' => 'cheque']);
    }

    private function makeAgent(array $attrs): User
    {
        $u = User::factory()->create($attrs + ['role' => Role::Agent, 'status' => UserStatus::Active]);
        $u->assignRole('agent');
        AgencyAgent::create(['agency_id' => $this->agency->id, 'user_id' => $u->id, 'commission_split_percent' => 50,
            'lead_allocation_position' => 0, 'ffc_number' => 'FFC-' . $u->id, 'ffc_expires_at' => CarbonImmutable::now()->addYear(), 'status' => 'active']);

        return $u;
    }

    private function commission(User $agent, float $net, string $status = 'approved'): Commission
    {
        return Commission::create([
            'agency_id' => $this->agency->id, 'agent_id' => $agent->id, 'deal_type' => 'sale', 'deal_value' => 1_000_000,
            'gross_commission' => $net * 2, 'agent_split_percent' => 50, 'agent_amount' => $net, 'agency_amount' => $net,
            'vat_amount' => 0, 'agent_net' => $net, 'status' => $status,
        ]);
    }

    private function verifyTrust(): void
    {
        $this->agency->update([
            'trust_bank' => 'First National Bank (FNB)', 'trust_account_holder' => 'Basket Realty Trust', 'trust_account_number' => '63224695940',
            'trust_branch_code' => '255355', 'trust_account_type' => 'current', 'trust_auditor_name' => 'Shaba Dreams',
            'trust_auditor_practice_number' => '904887', 'trust_verified_at' => now(),
        ]);
    }

    private function settings(array $overrides = []): array
    {
        return $overrides + ['vat_registered' => 0, 'vat_rate' => 15, 'payout_day' => 25, 'payout_method' => 'paystack'];
    }

    #[Test]
    public function the_trust_account_method_needs_a_verified_trust_account(): void
    {
        $this->actingAs($this->owner)->patch('/agency/settings', $this->settings(['payout_method' => 'trust_account']))
            ->assertSessionHasErrors('payout_method');
        $this->assertSame('paystack', $this->agency->fresh()->payout_method);

        $this->agency->update(['trust_account_number' => '63224695940', 'trust_bank' => 'FNB']); // captured, still in review
        $this->actingAs($this->owner)->patch('/agency/settings', $this->settings(['payout_method' => 'trust_account']))
            ->assertSessionHasErrors('payout_method');

        $this->verifyTrust();
        $this->actingAs($this->owner)->patch('/agency/settings', $this->settings(['payout_method' => 'trust_account']))
            ->assertSessionHasNoErrors();
        $this->assertSame('trust_account', $this->agency->fresh()->payout_method);

        $this->actingAs($this->owner)->get('/agency/settings')->assertOk()
            ->assertInertia(fn (Assert $p) => $p->where('agency.payout_method', 'trust_account')->where('agency.trust_status', 'verified'));
    }

    #[Test]
    public function settings_can_no_longer_change_trust_bank_details_behind_verification(): void
    {
        $this->verifyTrust();
        $this->actingAs($this->owner)->patch('/agency/settings', $this->settings(['trust_account_number' => '99999999999', 'trust_bank' => 'Other']));

        $a = $this->agency->fresh();
        $this->assertSame('63224695940', $a->trust_account_number, 'Trust details are only edited on the verified Trust Account page');
        $this->assertNotNull($a->trust_verified_at);
    }

    #[Test]
    public function a_trust_account_payout_is_prepared_downloaded_and_marked_paid(): void
    {
        Notification::fake();
        $this->verifyTrust();
        $this->agency->update(['payout_method' => 'trust_account']);
        $this->commission($this->agent, 12_500);
        $this->commission($this->agent, 2_500);
        $this->commission($this->agent2, 8_000);

        $this->actingAs($this->owner)->post('/agency/commissions/payout')->assertSessionHas('success');
        $batch = PayoutBatch::firstOrFail();
        $this->assertSame(['processing', 'trust_account'], [$batch->status, $batch->method]);
        $this->assertSame(3, Commission::where('status', 'approved')->count(), 'Nothing is paid until the agency confirms the EFT');
        Notification::assertNothingSent();

        $this->actingAs($this->owner)->get('/agency/commissions')->assertOk()
            ->assertInertia(fn (Assert $p) => $p->where('payout.method', 'trust_account')
                ->where('eft_batch.id', $batch->id)
                ->where('eft_batch.total', 23000)
                ->has('eft_batch.payees', 2)
                ->where('eft_batch.payees', fn ($ps) => collect($ps)->firstWhere('agent', 'Sipho Dlamini')['amount'] == 15000));

        // Bank bulk-payment file: one line per agent with their banking details.
        $csv = $this->actingAs($this->owner)->get("/agency/commissions/batches/{$batch->id}/eft.csv")->assertOk()->streamedContent();
        $lines = array_map('str_getcsv', array_filter(explode("\n", trim($csv))));
        $this->assertSame('Beneficiary name', $lines[0][0]);
        $this->assertCount(3, $lines);
        $sipho = collect($lines)->first(fn ($l) => $l[0] === 'S DLAMINI');
        $this->assertSame(['Capitec', '1234567890', '470010', 'savings', '15000.00'], array_slice($sipho, 1, 5));

        // A second run can't start while this one is unpaid.
        $this->commission($this->agent2, 1_000);
        $this->actingAs($this->owner)->post('/agency/commissions/payout')->assertSessionHas('error');

        $this->actingAs($this->owner)->post("/agency/commissions/batches/{$batch->id}/paid", ['reference' => 'FNB 20261109-01'])->assertSessionHas('success');
        $batch->refresh();
        $this->assertSame(['completed', 'FNB 20261109-01'], [$batch->status, $batch->paid_reference]);
        $this->assertSame(3, Commission::where('payout_batch_id', $batch->id)->where('status', 'paid')->count());
        Notification::assertSentTo($this->agent, CommissionPaid::class, fn ($n) => $n->commissions->count() === 2
            && str_contains(implode(' ', $n->toMail($this->agent)->introLines), 'trust account'));
        Notification::assertSentTo($this->agent2, CommissionPaid::class);

        // Only once.
        $this->actingAs($this->owner)->post("/agency/commissions/batches/{$batch->id}/paid")->assertSessionHas('error');
    }

    #[Test]
    public function agents_without_bank_details_hold_up_an_eft_payout(): void
    {
        $this->verifyTrust();
        $this->agency->update(['payout_method' => 'trust_account']);
        $noBank = $this->makeAgent(['name' => 'Thabo Paystack', 'paystack_recipient_code' => 'RCP_123']);
        $this->commission($noBank, 5_000);

        $this->actingAs($this->owner)->post('/agency/commissions/payout')
            ->assertSessionHas('error', fn ($m) => str_contains($m, 'Thabo Paystack'));
        $this->assertSame(0, PayoutBatch::where('status', 'processing')->count());
    }

    #[Test]
    public function only_the_agencys_admin_can_see_or_settle_its_eft_batches(): void
    {
        $this->verifyTrust();
        $this->agency->update(['payout_method' => 'trust_account']);
        $this->commission($this->agent, 5_000);
        $this->actingAs($this->owner)->post('/agency/commissions/payout');
        $batch = PayoutBatch::firstOrFail();

        $otherOwner = User::factory()->create(['role' => Role::AgencyAdmin, 'status' => UserStatus::Active]);
        $otherOwner->assignRole('agency_admin');
        $other = Agency::create(['user_id' => $otherOwner->id, 'name' => 'Other', 'slug' => 'o-' . Str::random(6), 'email' => $otherOwner->email, 'status' => 'active']);
        $other->activateSubscription('promo', now()->addYear());

        $this->actingAs($otherOwner)->get("/agency/commissions/batches/{$batch->id}/eft.csv")->assertNotFound();
        $this->actingAs($otherOwner)->post("/agency/commissions/batches/{$batch->id}/paid")->assertNotFound();
        $this->assertSame('processing', $batch->fresh()->status);
    }

    #[Test]
    public function paystack_payouts_still_run_as_before(): void
    {
        Notification::fake();
        $this->commission($this->agent, 7_000);

        $this->actingAs($this->owner)->post('/agency/commissions/payout')->assertSessionHas('success');
        $batch = PayoutBatch::firstOrFail();
        $this->assertSame(['completed', 'paystack'], [$batch->status, $batch->method]);
        $this->assertSame('paid', Commission::first()->status);
        Notification::assertSentTo($this->agent, CommissionPaid::class);
    }
}
