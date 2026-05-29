<?php

namespace Database\Seeders;

use App\Enums\Role as RoleEnum;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\Commission;
use App\Models\Inquiry;
use App\Models\Lease;
use App\Models\Listing;
use App\Models\RentPayment;
use App\Models\User;
use App\Services\CommissionService;
use App\Services\PaystackService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class Phase3DemoSeeder extends Seeder
{
    public function __construct(
        private readonly CommissionService $commissions,
        private readonly PaystackService $paystack,
    ) {}

    public function run(): void
    {
        $tenants = $this->seedTenantPool();
        $this->seedLeasesAndPayments($tenants);
        $this->seedInquiryPipeline($tenants);
    }

    private function seedTenantPool(): array
    {
        $tenants = [
            ['email' => 'tshepo.khumalo@example.test', 'name' => 'Tshepo Khumalo'],
            ['email' => 'naledi.sithole@example.test', 'name' => 'Naledi Sithole'],
            ['email' => 'pieter.botha@example.test', 'name' => 'Pieter Botha'],
            ['email' => 'kayla.naidoo@example.test', 'name' => 'Kayla Naidoo'],
            ['email' => 'andile.maseko@example.test', 'name' => 'Andile Maseko'],
            ['email' => 'rian.adams@example.test', 'name' => 'Rian Adams'],
        ];

        $users = [];
        foreach ($tenants as $i => $t) {
            $u = User::updateOrCreate(
                ['email' => $t['email']],
                [
                    'name' => $t['name'],
                    'password' => Hash::make('password'),
                    'role' => RoleEnum::Tenant,
                    'status' => UserStatus::Active,
                    'phone' => '+27 82 555 0'.($i + 200),
                    'email_verified_at' => now(),
                    'invite_accepted_at' => now(),
                ]
            );
            $u->syncRoles([RoleEnum::Tenant->value]);
            $users[] = $u;
        }

        return $users;
    }

    private function seedLeasesAndPayments(array $tenants): void
    {
        // Each lease is an active rental tied to one of the agency's listings.
        $blueprints = [
            ['slug' => 'rosebank-2-bed-rental', 'tenant' => 0, 'rent' => 18500, 'started' => '2025-11-01'],
            ['slug' => 'sandton-bachelor-pad', 'tenant' => 1, 'rent' => 9800,  'started' => '2026-01-15'],
            ['slug' => 'camps-bay-villa',      'tenant' => 2, 'rent' => 65000, 'started' => '2025-09-01'],
            ['slug' => 'franschhoek-cottage',  'tenant' => 3, 'rent' => 22000, 'started' => '2026-02-01'],
            ['slug' => 'greenside-garden-cottage', 'tenant' => 4, 'rent' => 7500, 'started' => '2025-12-01'],
        ];

        foreach ($blueprints as $bp) {
            $listing = Listing::where('slug', $bp['slug'])->first();
            if (! $listing) {
                continue;
            }

            $tenant = $tenants[$bp['tenant']];
            $start = CarbonImmutable::parse($bp['started']);
            $end = $start->addYear();

            $lease = Lease::updateOrCreate(
                ['listing_id' => $listing->id, 'tenant_id' => $tenant->id],
                [
                    'landlord_id' => $listing->owner_type === \App\Models\Landlord::class
                        ? $listing->owner?->user_id
                        : null,
                    'agency_id' => $listing->owner_type === Agency::class ? $listing->owner_id : null,
                    'agent_id' => $listing->agent_id,
                    'start_date' => $start->toDateString(),
                    'end_date' => $end->toDateString(),
                    'monthly_rent' => $bp['rent'],
                    'deposit_amount' => $bp['rent'] * 1.5,
                    'deposit_interest_rate' => 6.75,
                    'escalation_percent' => 8,
                    'notice_period_days' => 30,
                    'status' => 'active',
                    'signed_at' => $start->subDay(),
                ]
            );

            // Backfill rent payments from the lease start to current month.
            $cursor = $start->startOfMonth();
            $now = CarbonImmutable::now()->startOfMonth();
            while ($cursor->lessThanOrEqualTo($now)) {
                $period = $cursor->format('Y-m');
                $isCurrent = $cursor->equalTo($now);
                RentPayment::updateOrCreate(
                    ['lease_id' => $lease->id, 'period_month' => $period],
                    [
                        'amount' => $bp['rent'],
                        'due_date' => $cursor->day(1)->toDateString(),
                        'paid_at' => $isCurrent ? null : $cursor->day(3)->toDateTimeString(),
                        'payment_method' => $isCurrent ? null : 'paystack_eft',
                        'paystack_reference' => $isCurrent ? null : 'PB_STUB_'.strtoupper(substr(md5($period.$lease->id), 0, 12)),
                        'status' => $isCurrent ? 'pending' : 'paid',
                    ]
                );
                $cursor = $cursor->addMonth();
            }

            // For agency leases, generate a Commission row via the service
            if ($lease->agency_id && $lease->agent_id) {
                $agent = User::find($lease->agent_id);
                $existing = Commission::where('lease_id', $lease->id)->first();
                if (! $existing) {
                    $this->commissions->calculate($lease, $agent, 'rental');
                }
            }
        }

        // Most agents are Paystack-linked. Leave one (Tania) without a code so
        // the dashboard shows a real "blocked: paystack_missing" example.
        foreach (['sipho@sandton-realty.test', 'aisha@sandton-realty.test', 'karabo@winelands.test'] as $email) {
            $u = User::where('email', $email)->first();
            if ($u && empty($u->paystack_recipient_code)) {
                $this->paystack->createTransferRecipient($u);
            }
        }

        // Re-evaluate compliance now that some agents have Paystack set up
        foreach (Commission::all() as $c) {
            if ($c->status === 'blocked') {
                $c->update(['status' => 'pending', 'blocked_reason' => null]);
                $this->commissions->blockIfNonCompliant($c);
            }
        }

        // Approve all currently-pending commissions so they're queued for the next payout batch
        Commission::where('status', 'pending')->update(['status' => 'approved']);

        // Create a pending payout batch for Sandton Realty
        $sandton = Agency::where('slug', 'sandton-realty')->first();
        if ($sandton) {
            $existingBatch = $sandton->payoutBatches()->where('status', 'pending')->first();
            if (! $existingBatch) {
                $this->commissions->runMonthlyBatch($sandton);
            }
        }
    }

    private function seedInquiryPipeline(array $tenants): void
    {
        $listings = Listing::where('status', 'available')->take(6)->get();
        $statuses = ['new', 'contacted', 'qualified', 'viewing', 'offer', 'closed', 'lost'];

        foreach ($listings as $i => $listing) {
            $agentId = $listing->agent_id;
            if (! $agentId) {
                continue;
            }
            $status = $statuses[$i % count($statuses)];
            Inquiry::updateOrCreate(
                ['listing_id' => $listing->id, 'email' => 'pipeline-'.$i.'@example.test'],
                [
                    'name' => 'Pipeline Lead '.($i + 1),
                    'phone' => '+27 82 600 0'.(100 + $i),
                    'message' => 'Demo lead at status '.$status,
                    'assigned_to' => $agentId,
                    'source' => 'website',
                    'status' => $status,
                    'allocated_at' => now()->subDays($i + 1),
                    'allocation_method' => 'round_robin',
                ]
            );
        }
    }
}
