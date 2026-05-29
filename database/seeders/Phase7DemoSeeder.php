<?php

namespace Database\Seeders;

use App\Enums\Role as RoleEnum;
use App\Enums\UserStatus;
use App\Models\Contractor;
use App\Models\Conversation;
use App\Models\Lease;
use App\Models\Listing;
use App\Models\MaintenanceInvoice;
use App\Models\MaintenanceQuote;
use App\Models\MaintenanceRequest;
use App\Models\Message;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class Phase7DemoSeeder extends Seeder
{
    public function run(): void
    {
        $themba = $this->ensureContractor();

        $this->seedJobsForContractor($themba);
        $this->seedQuotes($themba);
        $this->seedInvoices($themba);
        $this->seedConversation($themba);

        $this->command->info('Phase 7 seed complete — Themba Mokoena (themba@plumbpro.test / password) now has demo jobs, quotes, invoices.');
    }

    /**
     * Create the documented demo contractor `themba@plumbpro.test` if missing.
     */
    private function ensureContractor(): Contractor
    {
        $user = User::updateOrCreate(
            ['email' => 'themba@plumbpro.test'],
            [
                'name'              => 'Themba Mokoena',
                'phone'             => '+27 82 555 0410',
                'password'          => Hash::make('password'),
                'role'              => RoleEnum::Contractor,
                'status'            => UserStatus::Active,
                'email_verified_at' => now(),
            ]
        );
        $user->syncRoles([RoleEnum::Contractor->value]);

        return Contractor::updateOrCreate(
            ['user_id' => $user->id],
            [
                'business_name'             => 'PlumbPro Solutions',
                'specialities'              => ['plumbing', 'geysers', 'drainage'],
                'service_areas'             => ['Sandton', 'Rosebank', 'Fourways', 'Bryanston'],
                'vat_registered'            => true,
                'vat_number'                => '4123456789',
                'cipc_number'               => '2023/445566/07',
                'cipc_verified_at'          => now()->subMonths(6),
                'tax_clearance_verified_at' => now()->subMonths(2),
                'insurance_verified_at'     => now()->subMonths(1),
                'insurance_amount'          => 1_000_000,
                'average_rating'            => 4.8,
                'total_reviews'             => 47,
                'total_jobs'                => 147,
                'status'                    => 'active',
            ]
        );
    }

    /**
     * Assign Themba to demo maintenance requests in various states.
     */
    private function seedJobsForContractor(Contractor $contractor): void
    {
        $userId = $contractor->user_id;
        $now    = CarbonImmutable::now();

        // ── Re-assign the existing "Leaking kitchen tap" from Phase5 ──────
        $existing = MaintenanceRequest::where('title', 'Leaking kitchen tap')->first();
        if ($existing) {
            $existing->update(['assigned_to' => $userId, 'status' => 'in_progress']);
        }

        // ── Find a Sandton-area lease for additional jobs ─────────────────
        $sandtonLease = Lease::whereHas('listing', fn ($q) => $q->where('suburb', 'Sandton'))
            ->where('status', 'active')
            ->with(['listing', 'tenant'])
            ->first();

        $rosebank = Lease::whereHas('listing', fn ($q) => $q->where('suburb', 'Rosebank'))
            ->where('status', 'active')
            ->with(['listing', 'tenant'])
            ->first();

        // ── To-commence: blocked drain (assigned, status=open) ───────────
        if ($sandtonLease) {
            MaintenanceRequest::updateOrCreate(
                ['lease_id' => $sandtonLease->id, 'title' => 'Blocked drain – main bathroom'],
                [
                    'property_id'         => $sandtonLease->listing_id,
                    'submitted_by'        => $sandtonLease->tenant_id,
                    'description'         => 'Bathroom sink and shower drain backing up since yesterday.',
                    'category'            => 'plumbing',
                    'urgency'             => 'high',
                    'preferred_date'      => $now->addDay(),
                    'preferred_time_slot' => 'Afternoon (13:00 – 17:00)',
                    'photos'              => [['caption' => 'Sink standing water'], ['caption' => 'Shower drain']],
                    'assigned_to'         => $userId,
                    'status'              => 'open',
                ]
            );
        }

        // ── In-progress: bathroom retile ─────────────────────────────────
        if ($rosebank) {
            MaintenanceRequest::updateOrCreate(
                ['lease_id' => $rosebank->id, 'title' => 'Bathroom retile (waterproofing)'],
                [
                    'property_id'         => $rosebank->listing_id,
                    'submitted_by'        => $rosebank->tenant_id,
                    'description'         => 'Cracked grout + 4 loose tiles around shower base. Day 2 of 3.',
                    'category'            => 'plumbing',
                    'urgency'             => 'medium',
                    'preferred_date'      => $now->subDay(),
                    'photos'              => [],
                    'assigned_to'         => $userId,
                    'status'              => 'in_progress',
                ]
            );
        }

        // ── Completed (no invoice yet) ───────────────────────────────────
        if ($sandtonLease) {
            MaintenanceRequest::updateOrCreate(
                ['lease_id' => $sandtonLease->id, 'title' => 'Tap washer replacement'],
                [
                    'property_id'  => $sandtonLease->listing_id,
                    'submitted_by' => $sandtonLease->tenant_id,
                    'description'  => 'Replaced washers on cold + hot kitchen mixers.',
                    'category'     => 'plumbing',
                    'urgency'      => 'low',
                    'photos'       => [],
                    'assigned_to'  => $userId,
                    'status'       => 'completed',
                    'completed_at' => $now->subDays(2),
                ]
            );
        }

        // ── Paid: faucet replacement (with invoice) ──────────────────────
        $paidJob = null;
        if ($rosebank) {
            $paidJob = MaintenanceRequest::updateOrCreate(
                ['lease_id' => $rosebank->id, 'title' => 'Faucet replacement (master bath)'],
                [
                    'property_id'  => $rosebank->listing_id,
                    'submitted_by' => $rosebank->tenant_id,
                    'description'  => 'Master bath mixer leaking at base — replaced with new Cobra unit.',
                    'category'     => 'plumbing',
                    'urgency'      => 'medium',
                    'photos'       => [],
                    'assigned_to'  => $userId,
                    'status'       => 'paid',
                    'completed_at' => $now->subDays(28),
                ]
            );
        }

        if ($paidJob) {
            MaintenanceInvoice::updateOrCreate(
                ['maintenance_request_id' => $paidJob->id],
                [
                    'contractor_id'      => $contractor->id,
                    'line_items'         => [
                        ['desc' => 'Cobra mixer (supply)', 'qty' => 1, 'unit' => 1_200],
                        ['desc' => 'Labour (1.5 hours)',   'qty' => 1.5, 'unit' => 450],
                    ],
                    'original_quote_total' => 1_840,
                    'invoice_subtotal'     => 1_600,
                    'vat_amount'           => 240,
                    'invoice_total'        => 1_840,
                    'deviation_amount'     => 0,
                    'paystack_reference'   => 'PYS_INV_THEMBA_001',
                    'status'               => 'paid',
                    'submitted_at'         => $now->subDays(26),
                    'approved_at'          => $now->subDays(25),
                    'paid_at'              => $now->subDays(21),
                ]
            );
        }

        // ── Open marketplace request (no assignment) — emergency siren ───
        $anyLease = Lease::where('status', 'active')->with(['listing', 'tenant'])->first();
        if ($anyLease) {
            MaintenanceRequest::updateOrCreate(
                ['lease_id' => $anyLease->id, 'title' => 'Burst geyser — water everywhere'],
                [
                    'property_id'  => $anyLease->listing_id,
                    'submitted_by' => $anyLease->tenant_id,
                    'description'  => 'Geyser burst in ceiling, water pouring through into bedroom. Power tripped.',
                    'category'     => 'plumbing',
                    'urgency'      => 'emergency',
                    'photos'       => [['caption' => 'Ceiling damage'], ['caption' => 'Water on floor']],
                    'assigned_to'  => null,
                    'status'       => 'open',
                ]
            );
        }
    }

    /**
     * Seed sample quotes in various states.
     */
    private function seedQuotes(Contractor $contractor): void
    {
        $req = MaintenanceRequest::where('assigned_to', $contractor->user_id)->first();
        if (! $req) {
            return;
        }

        $now = CarbonImmutable::now();

        $quotes = [
            ['status' => 'sent',     'sub' => 9_430, 'expires' => $now->addDays(2),  'title' => 'Geyser replacement – 200L Kwikot'],
            ['status' => 'sent',     'sub' => 1_600, 'expires' => $now->addDays(8),  'title' => 'Faucet replacement quote'],
            ['status' => 'accepted', 'sub' => 4_200, 'expires' => $now->addDays(5),  'title' => 'Bathroom retile materials + labour'],
            ['status' => 'draft',    'sub' => 850,   'expires' => null,              'title' => 'Pipe insulation upgrade (DRAFT)'],
            ['status' => 'rejected', 'sub' => 12_500,'expires' => $now->subDays(3),  'title' => 'Whole-house repipe (rejected)'],
            ['status' => 'expired',  'sub' => 2_800, 'expires' => $now->subDays(10), 'title' => 'Pressure pump install'],
        ];

        foreach ($quotes as $i => $q) {
            $vat   = $q['sub'] * 0.15;
            $total = $q['sub'] + $vat;
            MaintenanceQuote::updateOrCreate(
                ['contractor_id' => $contractor->id, 'maintenance_request_id' => $req->id, 'notes' => 'Demo quote #' . $i],
                [
                    'line_items'     => [
                        ['desc' => 'Materials', 'qty' => 1, 'unit' => $q['sub'] * 0.7],
                        ['desc' => 'Labour',    'qty' => 1, 'unit' => $q['sub'] * 0.3],
                    ],
                    'subtotal'       => $q['sub'],
                    'vat_amount'     => $vat,
                    'total'          => $total,
                    'vat_registered' => true,
                    'status'         => $q['status'],
                    'sent_at'        => $q['status'] === 'draft' ? null : $now->subDays($i + 1),
                    'expires_at'     => $q['expires'],
                ]
            );
        }
    }

    /**
     * Seed sample invoices in various states.
     */
    private function seedInvoices(Contractor $contractor): void
    {
        $req = MaintenanceRequest::where('assigned_to', $contractor->user_id)->first();
        if (! $req) {
            return;
        }

        $now = CarbonImmutable::now();

        $rows = [
            ['status' => 'submitted', 'sub' => 1_200, 'submitted_days' => 2,  'paid_days' => null, 'approved_days' => null, 'deviation' => 0,    'title' => 'Drain unblock invoice'],
            ['status' => 'approved',  'sub' => 3_400, 'submitted_days' => 5,  'paid_days' => null, 'approved_days' => 2,    'deviation' => 200,  'title' => 'Pipe repair (small overrun)'],
            ['status' => 'paid',      'sub' => 1_600, 'submitted_days' => 28, 'paid_days' => 21,   'approved_days' => 25,   'deviation' => 0,    'title' => 'Faucet replacement (paid)'],
            ['status' => 'paid',      'sub' => 5_800, 'submitted_days' => 55, 'paid_days' => 48,   'approved_days' => 52,   'deviation' => -300, 'title' => 'Geyser swap (Apr)'],
            ['status' => 'disputed',  'sub' => 980,   'submitted_days' => 10, 'paid_days' => null, 'approved_days' => null, 'deviation' => 0,    'title' => 'Missing receipt — disputed'],
        ];

        foreach ($rows as $i => $row) {
            $vat   = $row['sub'] * 0.15;
            $total = $row['sub'] + $vat;
            MaintenanceInvoice::updateOrCreate(
                ['contractor_id' => $contractor->id, 'maintenance_request_id' => $req->id, 'deviation_notes' => 'Demo invoice #' . $i],
                [
                    'line_items'           => [
                        ['desc' => 'Materials', 'qty' => 1, 'unit' => $row['sub'] * 0.6],
                        ['desc' => 'Labour',    'qty' => 1, 'unit' => $row['sub'] * 0.4],
                    ],
                    'original_quote_total' => $row['sub'] - $row['deviation'],
                    'invoice_subtotal'     => $row['sub'],
                    'vat_amount'           => $vat,
                    'invoice_total'        => $total,
                    'deviation_amount'     => $row['deviation'],
                    'paystack_reference'   => $row['status'] === 'paid' ? 'PYS_INV_THEMBA_' . str_pad((string)($i + 100), 4, '0', STR_PAD_LEFT) : null,
                    'status'               => $row['status'],
                    'submitted_at'         => $now->subDays($row['submitted_days']),
                    'approved_at'          => $row['approved_days'] !== null ? $now->subDays($row['approved_days']) : null,
                    'paid_at'              => $row['paid_days'] !== null ? $now->subDays($row['paid_days']) : null,
                ]
            );
        }
    }

    /**
     * Seed a conversation between Themba and a Sandton Realty agent.
     */
    private function seedConversation(Contractor $contractor): void
    {
        $userId = $contractor->user_id;
        $agent  = User::where('email', 'sipho@sandton-realty.test')->first();
        if (! $agent) {
            return;
        }

        $existing = Conversation::whereJsonContains('participants', $userId)
            ->whereJsonContains('participants', $agent->id)
            ->first();

        if ($existing) {
            return;
        }

        $conv = Conversation::create([
            'type'         => 'agent_contractor',
            'participants' => [$userId, $agent->id],
        ]);

        $base = CarbonImmutable::now()->subHours(4);
        $exchanges = [
            [$agent->id, "Hey Themba — your geyser quote for the Centurion property looks good. Owner has approved. Can you book in for Thursday?"],
            [$userId,    "Hi Sipho — yes, Thursday 10am works. I'll bring the 200L Kwikot and the safety valve."],
            [$agent->id, "Perfect. Tenant has been notified. Please send invoice through Property Basket once done so the trust account can process payout same week."],
            [$userId,    "Noted. I'll send a completion photo before invoicing."],
        ];

        foreach ($exchanges as $i => [$senderId, $body]) {
            Message::create([
                'conversation_id' => $conv->id,
                'sender_id'       => $senderId,
                'body'            => $body,
                'read_at'         => $i < 3 ? CarbonImmutable::now()->subHours(1) : null,
                'created_at'      => $base->addMinutes($i * 12),
                'updated_at'      => $base->addMinutes($i * 12),
            ]);
        }

        $conv->touch();
    }
}
