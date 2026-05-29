<?php

namespace Database\Seeders;

use App\Models\PlatformPlan;
use App\Support\PlatformPlans;
use Illuminate\Database\Seeder;

class PlatformPlansSeeder extends Seeder
{
    public function run(): void
    {
        $order = 0;
        foreach (PlatformPlans::defaults() as $key => $plan) {
            PlatformPlan::updateOrCreate(
                ['key' => $key],
                [
                    'name'       => $plan['name'],
                    'audience'   => $plan['audience'],
                    'price'      => $plan['price'],
                    'headline'   => $plan['headline'],
                    'features'   => $plan['features'],
                    'is_popular' => $plan['popular'] ?? false,
                    'sort_order' => $order++,
                    'is_active'  => true,
                ],
            );
        }
    }
}
