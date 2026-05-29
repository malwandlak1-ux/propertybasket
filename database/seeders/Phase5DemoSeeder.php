<?php

namespace Database\Seeders;

use App\Models\Conversation;
use App\Models\Deposit;
use App\Models\Inspection;
use App\Models\Lease;
use App\Models\MaintenanceRequest;
use App\Models\Message;
use App\Models\User;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

class Phase5DemoSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = User::where('email', 'tshepo.khumalo@example.test')->first();
        if (! $tenant) {
            $this->command->warn('Tenant tshepo.khumalo@example.test not found — run Phase3DemoSeeder first.');
            return;
        }

        $lease = Lease::where('tenant_id', $tenant->id)
            ->where('status', 'active')
            ->orderByDesc('start_date')
            ->with(['listing', 'agent'])
            ->first();

        if (! $lease) {
            $this->command->warn('No active lease for demo tenant — skipping Phase 5 demo data.');
            return;
        }

        $this->seedDeposit($lease);
        $this->seedMoveInInspection($lease);
        $this->seedMaintenance($tenant, $lease);
        $this->seedConversations($tenant, $lease);
    }

    private function seedDeposit(Lease $lease): void
    {
        $start = CarbonImmutable::parse($lease->start_date);
        $now = CarbonImmutable::now();
        $months = max(1, (int) floor($start->diffInDays($now) / 30.44));
        $deposit = (float) $lease->deposit_amount;
        // Approximate compound monthly interest at the lease rate
        $rate = (float) ($lease->deposit_interest_rate ?? 6.75);
        $monthlyRate = $rate / 100 / 12;
        $accrued = round($deposit * ((1 + $monthlyRate) ** $months - 1), 2);

        Deposit::updateOrCreate(
            ['lease_id' => $lease->id],
            [
                'amount_deposited'  => $deposit,
                'deposited_at'      => $start,
                'interest_rate'     => $rate,
                'accrued_interest'  => $accrued,
                'last_accrual_date' => $now->startOfMonth(),
                'status'            => 'held',
            ]
        );
    }

    private function seedMoveInInspection(Lease $lease): void
    {
        $existing = Inspection::where('lease_id', $lease->id)->where('type', 'move_in')->first();
        if ($existing) {
            return;
        }

        $start = CarbonImmutable::parse($lease->start_date);

        Inspection::create([
            'lease_id'        => $lease->id,
            'type'            => 'move_in',
            'conducted_by'    => $lease->agent_id,
            'tenant_id'       => $lease->tenant_id,
            'status'          => 'completed',
            'rooms'           => [
                ['name' => 'Entrance / Hallway', 'photos' => [['caption' => 'Front door'], ['caption' => 'Hallway']], 'notes' => 'Clean.'],
                ['name' => 'Living Room',        'photos' => [['caption' => 'South wall'], ['caption' => 'Floor'], ['caption' => 'Window'], ['caption' => 'Ceiling']], 'notes' => 'All good.'],
                ['name' => 'Kitchen',            'photos' => [['caption' => 'Cabinets'], ['caption' => 'Counter top'], ['caption' => 'Stove'], ['caption' => 'Sink']], 'notes' => 'Appliances tested.'],
                ['name' => 'Bedroom 1',          'photos' => [['caption' => 'North wall'], ['caption' => 'Cupboards']], 'notes' => ''],
                ['name' => 'Bedroom 2',          'photos' => [['caption' => 'Window'], ['caption' => 'Floor']], 'notes' => ''],
                ['name' => 'Main Bathroom',      'photos' => [['caption' => 'Shower'], ['caption' => 'Basin']], 'notes' => ''],
                ['name' => 'Balcony',            'photos' => [['caption' => 'View']], 'notes' => 'One pre-existing chipped tile noted.'],
            ],
            'agent_signed_at'  => $start,
            'agent_signature'  => 'Agent signature',
            'tenant_signed_at' => $start,
            'tenant_signature' => 'Tenant signature',
            'deduction_total'  => 0,
        ]);
    }

    private function seedMaintenance(User $tenant, Lease $lease): void
    {
        // Active: leaking kitchen tap, assigned to a contractor
        $contractor = User::where('role', 'contractor')->first();

        MaintenanceRequest::updateOrCreate(
            [
                'lease_id'    => $lease->id,
                'submitted_by'=> $tenant->id,
                'title'       => 'Leaking kitchen tap',
            ],
            [
                'property_id'         => $lease->listing_id,
                'description'         => 'The cold-water tap above the sink drips constantly, getting worse over the last week.',
                'category'            => 'plumbing',
                'urgency'             => 'medium',
                'preferred_date'      => Carbon::tomorrow(),
                'preferred_time_slot' => 'Morning (08:00 – 12:00)',
                'photos'              => [['caption' => 'Tap close-up'], ['caption' => 'Wet cabinet']],
                'assigned_to'         => $contractor?->id,
                'status'              => 'in_progress',
            ]
        );

        // Past: bedroom light, completed
        MaintenanceRequest::updateOrCreate(
            [
                'lease_id'    => $lease->id,
                'submitted_by'=> $tenant->id,
                'title'       => 'Bedroom light not working',
            ],
            [
                'property_id'  => $lease->listing_id,
                'description' => 'Main bedroom ceiling light stopped working — bulb replacement did not help.',
                'category'    => 'electrical',
                'urgency'     => 'low',
                'photos'      => [],
                'assigned_to' => $contractor?->id,
                'status'      => 'completed',
                'completed_at'=> now()->subDays(20),
            ]
        );
    }

    private function seedConversations(User $tenant, Lease $lease): void
    {
        if (! $lease->agent_id) {
            return;
        }

        $existing = Conversation::whereJsonContains('participants', $tenant->id)
            ->whereJsonContains('participants', $lease->agent_id)
            ->first();

        if (! $existing) {
            $conv = Conversation::create([
                'type'         => 'agent_tenant',
                'participants' => [$tenant->id, $lease->agent_id],
            ]);

            $exchanges = [
                [$lease->agent_id, "Hi {$tenant->name}! Re: the leaking kitchen tap — I've assigned Jacob from Mokoena Plumbing. He's confirmed for tomorrow 10am."],
                [$tenant->id,      "Perfect, thanks! I'll be home from 09:30. Should I prepare anything?"],
                [$lease->agent_id, "Just clear the under-sink cabinet so he can access the pipes. Jacob will bring all spares."],
                [$tenant->id,      "Will do. Thanks for sorting it so quickly."],
            ];

            $base = now()->subHours(3);
            foreach ($exchanges as $i => [$senderId, $body]) {
                Message::create([
                    'conversation_id' => $conv->id,
                    'sender_id'       => $senderId,
                    'body'            => $body,
                    'read_at'         => $i < 2 ? now() : null,
                    'created_at'      => $base->copy()->addMinutes($i * 7),
                    'updated_at'      => $base->copy()->addMinutes($i * 7),
                ]);
            }

            $conv->touch();
        }

        // Optional: system reminder conversation (single-party from the tenant POV — skipped)
    }
}
