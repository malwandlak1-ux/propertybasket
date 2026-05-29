<?php

namespace Database\Seeders;

use App\Enums\Role as RoleEnum;
use App\Enums\UserStatus;
use App\Models\Conversation;
use App\Models\Landlord;
use App\Models\Lease;
use App\Models\Listing;
use App\Models\MaintenanceRequest;
use App\Models\Message;
use App\Models\RentPayment;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class Phase6DemoSeeder extends Seeder
{
    public function run(): void
    {
        $landlordUser = User::where('email', 'thandi.landlord@example.test')->first();
        if (! $landlordUser) {
            $this->command->warn('Landlord thandi.landlord@example.test not found — run DemoDataSeeder first.');
            return;
        }

        $landlord = Landlord::where('user_id', $landlordUser->id)->first();
        if (! $landlord) {
            $this->command->warn('Landlord record not found for Thandi.');
            return;
        }

        // ── 1. Add a 3rd long-term rental listing for Thandi ──────────────
        $thirdListing = $this->seedThirdListing($landlord);

        // ── 2. Seed demo tenant for the new third listing ─────────────────
        $tenantFatima = $this->seedFatima();

        // ── 3. greenside-garden-cottage already has a Phase3 lease (Andile) ─
        //    We do NOT create another lease on it here.
        $cottage = Listing::where('slug', 'greenside-garden-cottage')->first();
        $leaseCottage = $cottage
            ? Lease::where('listing_id', $cottage->id)->where('status', 'active')->first()
            : null;

        // ── 4. Lease for the new braamfontein listing ─────────────────────
        $leaseThird = $this->ensureLease($thirdListing, $tenantFatima, $landlord, '2025-08-01', 9_500);

        // ── 5. Backfill rent payments for new lease only ──────────────────
        $this->backfillPayments($leaseThird, 9_500, '2025-08-01');

        // Find Andile (the existing cottage tenant) for maintenance seeding
        $tenantAndile = $leaseCottage ? \App\Models\User::find($leaseCottage->tenant_id) : null;

        // ── 6. Maintenance requests ───────────────────────────────────────
        $this->seedMaintenance($landlordUser, $tenantAndile, $tenantFatima, $cottage, $thirdListing, $leaseCottage);

        // ── 7. Landlord ↔ tenant conversation ─────────────────────────────
        $this->seedConversations($landlordUser, $tenantAndile, $tenantFatima);

        // ── 8. Update landlord property_count ────────────────────────────
        $count = Listing::where('owner_type', Landlord::class)
            ->where('owner_id', $landlord->id)
            ->count();
        $landlord->update(['property_count' => $count]);

        $this->command->info("Phase 6 seeder complete: {$count} properties for Thandi.");
    }

    // ──────────────────────────────────────────────────────────────────────
    private function seedThirdListing(Landlord $landlord): Listing
    {
        return Listing::updateOrCreate(
            ['slug' => 'braamfontein-2-bed-apartment'],
            [
                'ulid'          => (string) Str::ulid(),
                'owner_type'    => Landlord::class,
                'owner_id'      => $landlord->id,
                'agent_id'      => null,
                'title'         => 'Thandi - 2 Bed Apartment in Braamfontein',
                'listing_type'  => 'long_term_rent',
                'property_type' => 'apartment',
                'monthly_rent'  => 9_500,
                'bedrooms'      => 2,
                'bathrooms'     => 1,
                'area_sqm'      => 78,
                'address'       => '14 De Korte Street, Braamfontein, Johannesburg, 2001',
                'suburb'        => 'Braamfontein',
                'city'          => 'Johannesburg',
                'province'      => 'Gauteng',
                'postal_code'   => '2001',
                'status'        => 'available',
                'description'   => 'Modern 2-bed apartment near Wits University. Fibre-ready, secure parking, on-site gym.',
                'primary_image' => 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1600&q=80',
                'gallery_images'=> [
                    'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1600&q=80',
                ],
                'amenities'     => [
                    'interior' => ['Air-con', 'Open-plan kitchen', 'Built-in cupboards', 'Fibre-ready'],
                    'exterior' => ['Secure parking', 'On-site gym', '24-hour security'],
                ],
            ]
        );
    }

    private function seedFatima(): User
    {
        $fatima = User::updateOrCreate(
            ['email' => 'fatima.hassan@example.test'],
            [
                'name'                => 'Fatima Hassan',
                'phone'               => '+27 83 444 0022',
                'password'            => Hash::make('password'),
                'role'                => RoleEnum::Tenant,
                'status'              => UserStatus::Active,
                'email_verified_at'   => now(),
                'invite_accepted_at'  => now(),
            ]
        );
        $fatima->syncRoles([RoleEnum::Tenant->value]);
        return $fatima;
    }

    private function ensureLease(Listing $listing, User $tenant, Landlord $landlord, string $started, int $rent): Lease
    {
        $start = CarbonImmutable::parse($started);
        $end   = $start->addYear();

        return Lease::updateOrCreate(
            ['listing_id' => $listing->id, 'tenant_id' => $tenant->id],
            [
                'landlord_id'          => $landlord->user_id,
                'agency_id'            => null,
                'agent_id'             => null,
                'start_date'           => $start->toDateString(),
                'end_date'             => $end->toDateString(),
                'monthly_rent'         => $rent,
                'deposit_amount'       => $rent * 2,
                'deposit_interest_rate'=> 6.75,
                'escalation_percent'   => 8,
                'notice_period_days'   => 30,
                'status'               => 'active',
                'signed_at'            => $start->subDay(),
            ]
        );
    }

    private function backfillPayments(Lease $lease, int $rent, string $started): void
    {
        $cursor = CarbonImmutable::parse($started)->startOfMonth();
        $now    = CarbonImmutable::now()->startOfMonth();

        while ($cursor->lessThanOrEqualTo($now)) {
            $period    = $cursor->format('Y-m');
            $isCurrent = $cursor->equalTo($now);

            RentPayment::updateOrCreate(
                ['lease_id' => $lease->id, 'period_month' => $period],
                [
                    'amount'               => $rent,
                    'due_date'             => $cursor->day(1)->toDateString(),
                    'paid_at'              => $isCurrent ? null : $cursor->day(2)->toDateTimeString(),
                    'payment_method'       => $isCurrent ? null : 'paystack_eft',
                    'paystack_reference'   => $isCurrent ? null : 'PB_LL_' . strtoupper(substr(md5($period . $lease->id), 0, 10)),
                    'status'               => $isCurrent ? 'pending' : 'paid',
                ]
            );

            $cursor = $cursor->addMonth();
        }
    }

    private function seedMaintenance(
        User $landlord,
        ?User $cottageUser,
        User $fatima,
        ?Listing $cottage,
        Listing $third,
        ?Lease $leaseCottage,
    ): void {
        // Open request from the cottage tenant: geyser not heating
        if ($cottage && $cottageUser && $leaseCottage) {
            MaintenanceRequest::updateOrCreate(
                [
                    'property_id'  => $cottage->id,
                    'submitted_by' => $cottageUser->id,
                    'title'        => 'Geyser not heating water',
                ],
                [
                    'lease_id'            => $leaseCottage->id,
                    'description'         => 'Hot water has been cold for 2 days. Checked the geyser switch — it is on, but the water stays cold.',
                    'category'            => 'plumbing',
                    'urgency'             => 'medium',
                    'preferred_date'      => now()->addDays(2),
                    'preferred_time_slot' => 'Morning (08:00 – 12:00)',
                    'photos'              => [['caption' => 'Geyser unit'], ['caption' => 'Temperature dial']],
                    'status'              => 'open',
                ]
            );

            MaintenanceRequest::updateOrCreate(
                [
                    'property_id'  => $cottage->id,
                    'submitted_by' => $cottageUser->id,
                    'title'        => 'Dripping kitchen tap',
                ],
                [
                    'lease_id'    => $leaseCottage->id,
                    'description' => 'Kitchen cold-water tap drips constantly.',
                    'category'    => 'plumbing',
                    'urgency'     => 'low',
                    'photos'      => [],
                    'status'      => 'completed',
                    'completed_at'=> now()->subDays(30),
                ]
            );
        }

        // Open request from Fatima: intercom not working
        $leaseThirdId = Lease::where('listing_id', $third->id)->where('tenant_id', $fatima->id)->value('id');
        MaintenanceRequest::updateOrCreate(
            [
                'property_id'  => $third->id,
                'submitted_by' => $fatima->id,
                'title'        => 'Intercom system not working',
            ],
            [
                'lease_id'    => $leaseThirdId,
                'description' => 'The intercom at the front entrance does not ring inside the unit. Visitors cannot buzz in.',
                'category'    => 'electrical',
                'urgency'     => 'low',
                'photos'      => [],
                'status'      => 'open',
            ]
        );
    }

    private function seedConversations(User $landlord, ?User $cottageUser, User $fatima): void
    {
        // Landlord ↔ Cottage tenant conversation
        if ($cottageUser) {
            $existing = Conversation::whereJsonContains('participants', $landlord->id)
                ->whereJsonContains('participants', $cottageUser->id)
                ->first();

            if (! $existing) {
                $conv = Conversation::create([
                    'type'         => 'landlord_tenant',
                    'participants' => [$landlord->id, $cottageUser->id],
                ]);

                $david = $cottageUser;
                $base      = now()->subDays(2);
                $exchanges = [
                    [$david->id,    "Hi Thandi, just to let you know the geyser is still not working. It's been cold for 2 days now."],
                    [$landlord->id, "Hi {$david->name}! So sorry to hear that. I've logged a request with a plumber. He should contact you by tomorrow morning."],
                    [$david->id,    "Thank you, I appreciate you sorting it quickly."],
                    [$landlord->id, "Of course! I'll follow up with the plumber this afternoon and keep you posted."],
                ];

                foreach ($exchanges as $i => [$senderId, $body]) {
                    Message::create([
                        'conversation_id' => $conv->id,
                        'sender_id'       => $senderId,
                        'body'            => $body,
                        'read_at'         => $i < 3 ? now() : null,
                        'created_at'      => $base->copy()->addMinutes($i * 15),
                        'updated_at'      => $base->copy()->addMinutes($i * 15),
                    ]);
                }

                $conv->touch();
            }
        }

        // Landlord ↔ Fatima (shorter thread)
        $existingF = Conversation::whereJsonContains('participants', $landlord->id)
            ->whereJsonContains('participants', $fatima->id)
            ->first();

        if (! $existingF) {
            $convF = Conversation::create([
                'type'         => 'landlord_tenant',
                'participants' => [$landlord->id, $fatima->id],
            ]);

            $base2     = now()->subDays(1);
            $exchangesF = [
                [$fatima->id,    "Hi Thandi, welcome message — I moved in yesterday. The apartment is lovely, thank you!"],
                [$landlord->id,  "Welcome, Fatima! So glad you're settling in well. Don't hesitate to reach out if you need anything."],
                [$fatima->id,    "One quick thing — the intercom at the entrance doesn't seem to ring inside. I've logged a maintenance request."],
            ];

            foreach ($exchangesF as $i => [$senderId, $body]) {
                Message::create([
                    'conversation_id' => $convF->id,
                    'sender_id'       => $senderId,
                    'body'            => $body,
                    'read_at'         => $i < 2 ? now() : null,
                    'created_at'      => $base2->copy()->addMinutes($i * 10),
                    'updated_at'      => $base2->copy()->addMinutes($i * 10),
                ]);
            }

            $convF->touch();
        }
    }
}
