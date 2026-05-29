<?php

namespace Database\Seeders;

use App\Models\AgencyAgent;
use App\Models\Commission;
use App\Models\Conversation;
use App\Models\Inspection;
use App\Models\Inquiry;
use App\Models\Lease;
use App\Models\Listing;
use App\Models\Message;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class Phase4DemoSeeder extends Seeder
{
    public function run(): void
    {
        // ── Pick the first agent (Sipho Dlamini) ──────────────────────────────
        $agent = User::where('email', 'sipho@sandton-realty.test')->first();
        if (! $agent) {
            $this->command->warn('Agent sipho@sandton-realty.test not found — run DemoDataSeeder first.');
            return;
        }

        $agentRecord = AgencyAgent::where('user_id', $agent->id)->first();
        if (! $agentRecord) {
            return;
        }

        // Listings assigned to this agent
        $listings = Listing::where('agent_id', $agent->id)->get();
        if ($listings->isEmpty()) {
            // Assign the first 3 agency listings to this agent
            Listing::where('owner_type', 'App\Models\Agency')
                ->whereNull('agent_id')
                ->take(3)
                ->each(fn ($l) => $l->update(['agent_id' => $agent->id]));
            $listings = Listing::where('agent_id', $agent->id)->get();
        }

        $this->seedInquiriesWithViewings($agent, $listings);
        $this->seedInspections($agent);
        $this->seedAgentCommissions($agent, $agentRecord);
        $this->seedAgentConversations($agent);
    }

    private function seedInquiriesWithViewings(User $agent, $listings): void
    {
        $leads = [
            // New leads
            ['name' => 'Naledi van Wyk',    'email' => 'naledi.vw@leads.test',   'status' => 'new',       'viewing' => null],
            ['name' => 'Riaan Pretorius',    'email' => 'riaan.p@leads.test',    'status' => 'contacted', 'viewing' => null],
            ['name' => 'Lerato Sithole',     'email' => 'lerato.s@leads.test',   'status' => 'new',       'viewing' => null],
            // Qualified
            ['name' => 'Jessica Adams',      'email' => 'jessica.a@leads.test',  'status' => 'qualified', 'viewing' => null],
            ['name' => 'Tebogo Maseko',      'email' => 'tebogo.m@leads.test',   'status' => 'qualified', 'viewing' => null],
            ['name' => 'Sipho Ndlovu',       'email' => 'sipho.nd@leads.test',   'status' => 'qualified', 'viewing' => null],
            // Viewing — with scheduled times
            ['name' => 'Thandi Mokoena',     'email' => 'thandi.m@leads.test',   'status' => 'viewing',   'viewing' => now()->setTime(10, 0)],
            ['name' => 'Karabo Modise',      'email' => 'karabo.mod@leads.test', 'status' => 'viewing',   'viewing' => now()->setTime(13, 30)],
            ['name' => 'Andile Zungu',       'email' => 'andile.z@leads.test',   'status' => 'viewing',   'viewing' => now()->addDay()->setTime(11, 0)],
            ['name' => 'Fatima Petersen',    'email' => 'fatima.p@leads.test',   'status' => 'viewing',   'viewing' => now()->addDays(2)->setTime(14, 0)],
            // Offer
            ['name' => 'Lungelo Dlamini',    'email' => 'lungelo.d@leads.test',  'status' => 'offer',     'viewing' => null],
            ['name' => 'Zanele Mthembu',     'email' => 'zanele.mt@leads.test',  'status' => 'offer',     'viewing' => null],
            // Closed
            ['name' => 'Property Basket Tenant', 'email' => 'pb.tenant@leads.test', 'status' => 'closed', 'viewing' => null],
        ];

        foreach ($leads as $idx => $data) {
            $listing = $listings->get($idx % max(1, $listings->count()));
            if (! $listing) {
                continue;
            }

            Inquiry::updateOrCreate(
                ['email' => $data['email'], 'listing_id' => $listing->id],
                [
                    'name'                 => $data['name'],
                    'phone'                => '+27 82 555 ' . str_pad($idx + 100, 4, '0', STR_PAD_LEFT),
                    'message'              => 'I am interested in this property.',
                    'source'               => ['website', 'property24', 'referral', 'walkin'][($idx) % 4],
                    'assigned_to'          => $agent->id,
                    'status'               => $data['status'],
                    'allocation_method'    => 'round_robin',
                    'allocated_at'         => now()->subDays(rand(1, 30)),
                    'viewing_scheduled_at' => $data['viewing'],
                ]
            );
        }
    }

    private function seedInspections(User $agent): void
    {
        // Find leases where agent is the agent
        $leases = Lease::where('agent_id', $agent->id)->with('listing', 'tenant')->take(3)->get();

        // If fewer than 3 leases, grab/assign more from the pool (any agent_id)
        if ($leases->count() < 3) {
            $existingIds = $leases->pluck('id')->all();
            Lease::whereNotIn('id', $existingIds)
                ->take(3 - $leases->count())
                ->get()
                ->each(fn ($l) => $l->update(['agent_id' => $agent->id]));
            $leases = Lease::where('agent_id', $agent->id)->with('listing', 'tenant')->take(3)->get();
        }

        if ($leases->isEmpty()) {
            return;
        }

        $inspectionData = [
            [
                'type'   => 'move_in',
                'status' => 'in_progress',
                'rooms'  => [
                    ['name' => 'Entrance / Hallway', 'photos' => [['caption' => 'Entrance'], ['caption' => 'Hallway floor']], 'notes' => 'Good condition.'],
                    ['name' => 'Living Room', 'photos' => [['caption' => 'South wall'], ['caption' => 'Floor/Tiles'], ['caption' => 'Window'], ['caption' => 'Ceiling'], ['caption' => '⚠ Small scuff (skirting)']], 'notes' => 'Small scuff on skirting board, pre-existing.'],
                    ['name' => 'Kitchen', 'photos' => [['caption' => 'Cabinets'], ['caption' => 'Counter top'], ['caption' => 'Stove top'], ['caption' => 'Sink'], ['caption' => 'Fridge space'], ['caption' => 'Extractor']], 'notes' => 'Spotless, all appliances working.'],
                    ['name' => 'Bedroom 1 (Main)', 'photos' => [['caption' => 'North wall'], ['caption' => 'Built-in cupboards'], ['caption' => 'En-suite door'], ['caption' => 'Ceiling'], ['caption' => 'Carpet']], 'notes' => ''],
                    ['name' => 'Bedroom 2', 'photos' => [], 'notes' => ''],
                    ['name' => 'Main Bathroom', 'photos' => [], 'notes' => ''],
                    ['name' => 'Guest Bathroom', 'photos' => [], 'notes' => ''],
                    ['name' => 'Balcony', 'photos' => [], 'notes' => ''],
                    ['name' => 'Parking Bay', 'photos' => [], 'notes' => ''],
                    ['name' => 'Storeroom', 'photos' => [], 'notes' => ''],
                    ['name' => 'Garden / Exterior', 'photos' => [], 'notes' => ''],
                    ['name' => 'Meters & Utilities', 'photos' => [], 'notes' => ''],
                ],
            ],
            [
                'type'   => 'move_in',
                'status' => 'completed',
                'rooms'  => [
                    ['name' => 'Entrance', 'photos' => [['caption' => 'Door'], ['caption' => 'Hallway']], 'notes' => 'Clean.'],
                    ['name' => 'Living Room', 'photos' => [['caption' => 'Main wall'], ['caption' => 'Floor']], 'notes' => ''],
                    ['name' => 'Kitchen', 'photos' => [['caption' => 'Cabinets'], ['caption' => 'Sink']], 'notes' => ''],
                ],
                'agent_signed_at'  => now()->subDays(40),
                'tenant_signed_at' => now()->subDays(40),
            ],
            [
                'type'   => 'move_out',
                'status' => 'completed',
                'rooms'  => [
                    ['name' => 'Kitchen', 'photos' => [['caption' => '⚠ Burn mark on cabinet'], ['caption' => '⚠ Chipped stove enamel']], 'notes' => 'Burn mark on cabinet door. Chipped enamel on stove top.'],
                    ['name' => 'Bedroom 1', 'photos' => [['caption' => '⚠ Hole in wall (nail)']], 'notes' => 'Small nail holes in wall.'],
                    ['name' => 'Balcony', 'photos' => [['caption' => '⚠ Cracked tile']], 'notes' => 'One cracked tile.'],
                ],
                'agent_signed_at'  => now()->subDays(5),
                'deduction_total'  => 3400.00,
            ],
        ];

        foreach ($inspectionData as $idx => $data) {
            $lease = $leases->get($idx);
            if (! $lease) {
                continue;
            }

            $insp = Inspection::updateOrCreate(
                ['lease_id' => $lease->id, 'type' => $data['type']],
                [
                    'conducted_by'     => $agent->id,
                    'tenant_id'        => $lease->tenant_id,
                    'status'           => $data['status'],
                    'rooms'            => $data['rooms'],
                    'agent_signed_at'  => $data['agent_signed_at'] ?? null,
                    'agent_signature'  => isset($data['agent_signed_at']) ? 'Agent signature' : null,
                    'tenant_signed_at' => $data['tenant_signed_at'] ?? null,
                    'tenant_signature' => isset($data['tenant_signed_at']) ? 'Tenant signature' : null,
                    'deduction_total'  => $data['deduction_total'] ?? 0,
                ]
            );
        }
    }

    private function seedAgentCommissions(User $agent, AgencyAgent $agentRecord): void
    {
        // Monthly commissions spread across YTD
        $monthly = [
            ['month' => 4, 'amount' => 18500, 'type' => 'rental', 'status' => 'paid'],
            ['month' => 3, 'amount' => 22000, 'type' => 'rental', 'status' => 'paid'],
            ['month' => 3, 'amount' => 45000, 'type' => 'sale',   'status' => 'paid'],
            ['month' => 2, 'amount' => 19800, 'type' => 'rental', 'status' => 'paid'],
            ['month' => 2, 'amount' => 38000, 'type' => 'sale',   'status' => 'paid'],
            ['month' => 1, 'amount' => 16500, 'type' => 'rental', 'status' => 'paid'],
            ['month' => 5, 'amount' => 42800, 'type' => 'sale',   'status' => 'approved'],
            ['month' => 5, 'amount' => 18400, 'type' => 'rental', 'status' => 'approved'],
        ];

        $listing = Listing::where('agent_id', $agent->id)->first();

        foreach ($monthly as $c) {
            $splitPct    = (float) $agentRecord->commission_split_percent / 100;
            $gross       = $c['amount'] * 0.05; // 5% gross commission on deal value
            $agentNet    = $gross * $splitPct;
            $agencyAmt   = $gross * (1 - $splitPct);
            $vatAmt      = $gross * 0.15;
            $date        = Carbon::create(2026, $c['month'], rand(5, 25));

            Commission::updateOrCreate(
                [
                    'agency_id'  => $agentRecord->agency_id,
                    'agent_id'   => $agent->id,
                    'deal_type'  => $c['type'],
                    'deal_value' => $c['amount'],
                ],
                [
                    'listing_id'           => $listing?->id,
                    'gross_commission'     => $gross,
                    'agent_split_percent'  => $agentRecord->commission_split_percent,
                    'agent_amount'         => $agentNet,
                    'agency_amount'        => $agencyAmt,
                    'vat_amount'           => $vatAmt,
                    'agent_net'            => $agentNet,
                    'status'               => $c['status'],
                    'paid_at'              => $c['status'] === 'paid' ? $date->copy()->addDays(3) : null,
                    'created_at'           => $date,
                    'updated_at'           => $date,
                ]
            );
        }
    }

    private function seedAgentConversations(User $agent): void
    {
        $leads = User::where('role', 'tenant')->take(4)->get();

        foreach ($leads as $lead) {
            $existing = Conversation::whereJsonContains('participants', $agent->id)
                ->whereJsonContains('participants', $lead->id)
                ->first();

            if ($existing) {
                continue;
            }

            $conv = Conversation::create([
                'type'         => 'agent_lead',
                'participants' => [$agent->id, $lead->id],
            ]);

            // Seed a small conversation
            $exchanges = [
                [$lead->id,  "Hi! I'm interested in viewing one of your properties. Is it still available?"],
                [$agent->id, "Hi {$lead->name}! Yes, absolutely still available. When would suit you for a viewing?"],
                [$lead->id,  "Would this week work? Maybe Thursday afternoon?"],
                [$agent->id, "Thursday at 14:00 works for me. I'll send you the address details."],
            ];

            $base = now()->subHours(rand(2, 48));
            foreach ($exchanges as $i => [$senderId, $body]) {
                Message::create([
                    'conversation_id' => $conv->id,
                    'sender_id'       => $senderId,
                    'body'            => $body,
                    'created_at'      => $base->copy()->addMinutes($i * 5),
                    'updated_at'      => $base->copy()->addMinutes($i * 5),
                ]);
            }

            $conv->touch();
        }
    }
}
