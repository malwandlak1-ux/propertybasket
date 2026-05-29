<?php

namespace Database\Seeders;

use App\Enums\Role as RoleEnum;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\Contractor;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class Phase8DemoSeeder extends Seeder
{
    public function run(): void
    {
        // ── 1. Assign realistic subscription tiers to existing agencies ──
        $tiers = [
            'sandton-realty'          => ['plan' => 'enterprise', 'status' => 'active'],
            'atlantic-seaboard-homes' => ['plan' => 'growth',     'status' => 'active'],
            'winelands-estates'       => ['plan' => 'starter',    'status' => 'active'],
        ];

        foreach ($tiers as $slug => $cfg) {
            Agency::where('slug', $slug)->update([
                'subscription_plan'       => $cfg['plan'],
                'subscription_expires_at' => now()->addYear(),
                'status'                  => $cfg['status'],
            ]);
        }

        // ── 2. Add a pending agency for the admin review queue ───────────
        $khayaOwner = User::updateOrCreate(
            ['email' => 'owner@khaya-properties.test'],
            [
                'name'              => 'Khaya Properties (Admin)',
                'password'          => Hash::make('password'),
                'role'              => RoleEnum::AgencyAdmin,
                'status'            => UserStatus::Active,
                'email_verified_at' => now(),
            ]
        );
        $khayaOwner->syncRoles([RoleEnum::AgencyAdmin->value]);

        Agency::updateOrCreate(
            ['slug' => 'khaya-properties'],
            [
                'user_id'            => $khayaOwner->id,
                'name'               => 'Khaya Properties',
                'email'              => 'owner@khaya-properties.test',
                'phone'              => '+27 31 555 0100',
                'head_office_address'=> '47 Florida Road, Morningside, Durban, 4001',
                'eaab_ffc_number'    => null,            // pending verification
                'eaab_verified_at'   => null,
                'vat_registered'     => false,
                'status'             => 'pending',
                'subscription_plan'  => 'starter',
            ]
        );

        // ── 3. Add a suspended agency to show that state ─────────────────
        $dodgyOwner = User::updateOrCreate(
            ['email' => 'owner@dodgy-rentals.test'],
            [
                'name'              => 'Dodgy Rentals (Admin)',
                'password'          => Hash::make('password'),
                'role'              => RoleEnum::AgencyAdmin,
                'status'            => UserStatus::Suspended,
                'email_verified_at' => now(),
            ]
        );
        $dodgyOwner->syncRoles([RoleEnum::AgencyAdmin->value]);

        Agency::updateOrCreate(
            ['slug' => 'dodgy-rentals'],
            [
                'user_id'            => $dodgyOwner->id,
                'name'               => 'Dodgy Rentals',
                'email'              => 'owner@dodgy-rentals.test',
                'phone'              => '+27 11 555 9999',
                'head_office_address'=> '1 Suspect Street, Hillbrow, Johannesburg, 2001',
                'eaab_ffc_number'    => 'FFC-2022-DR-001',
                'eaab_verified_at'   => null,           // FFC expired/unverified
                'vat_registered'     => false,
                'status'             => 'suspended',
                'subscription_plan'  => 'starter',
            ]
        );

        // ── 4. Add a contractor in 'review' state with incomplete docs ───
        $sparkUser = User::updateOrCreate(
            ['email' => 'sparkright@example.test'],
            [
                'name'              => 'SparkRight Electrical',
                'phone'             => '+27 21 555 0234',
                'password'          => Hash::make('password'),
                'role'              => RoleEnum::Contractor,
                'status'            => UserStatus::Active,
                'email_verified_at' => now(),
            ]
        );
        $sparkUser->syncRoles([RoleEnum::Contractor->value]);

        Contractor::updateOrCreate(
            ['user_id' => $sparkUser->id],
            [
                'business_name'             => 'SparkRight Electrical CC',
                'specialities'              => ['electrical', 'COC certificates'],
                'service_areas'              => ['Cape Town', 'Bellville'],
                'vat_registered'            => false,
                'cipc_number'               => '2025/123456/07',
                'cipc_verified_at'          => now(),
                'tax_clearance_verified_at' => null,        // pending
                'insurance_verified_at'     => null,        // pending
                'average_rating'            => 0,
                'total_reviews'             => 0,
                'total_jobs'                => 0,
                'status'                    => 'pending',
            ]
        );

        $this->command->info('Phase 8 seeder complete: subscription tiers set, pending+suspended agencies added, SparkRight contractor seeded.');
    }
}
