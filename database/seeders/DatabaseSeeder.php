<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RolesAndPermissionsSeeder::class,
            PlatformPlansSeeder::class,
            SuperAdminSeeder::class,
            DemoDataSeeder::class,
            Phase3DemoSeeder::class,
            Phase4DemoSeeder::class,
            Phase5DemoSeeder::class,
            Phase6DemoSeeder::class,
            Phase7DemoSeeder::class,
            Phase8DemoSeeder::class,
            DemoBlogSeeder::class,
            // Must run after agencies/landlords exist: seeds promo codes and
            // grandfathers existing accounts with an active subscription.
            PromoCodesSeeder::class,
        ]);
    }
}
