<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RolesAndPermissionsSeeder::class,
            SuperAdminSeeder::class,
            DemoDataSeeder::class,
            Phase3DemoSeeder::class,
            Phase4DemoSeeder::class,
            Phase5DemoSeeder::class,
            Phase6DemoSeeder::class,
            Phase7DemoSeeder::class,
            Phase8DemoSeeder::class,
            DemoBlogSeeder::class,
        ]);
    }
}
