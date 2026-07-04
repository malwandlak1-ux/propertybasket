<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Consolidator for every blog/advice post from the 90-day content plan.
 *
 * Runs all individual post seeders in publish-date order. Each one is
 * idempotent (keyed on slug, preserves its scheduled date), so this is safe
 * to run repeatedly — new posts only need to be appended here as future weeks
 * are built. One command publishes/schedules the whole catalogue:
 *
 *   php artisan db:seed --class=BlogContentSeeder --force
 */
class BlogContentSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            // Week 1 — Make Sense of the Rate Hike (already live)
            RepoRateBlogPostSeeder::class,          // Mon 29 Jun
            RepoVsPrimeBlogPostSeeder::class,       // Fri  3 Jul

            // Week 2 — First-Time Buyer Season
            FirstTimeBuyerBlogPostSeeder::class,    // Mon  6 Jul
            DepositGuideBlogPostSeeder::class,      // Wed  8 Jul
            TwoPotDepositBlogPostSeeder::class,     // Fri 10 Jul

            // Week 3 — Know Your Tenant Rights
            TenantRightsBlogPostSeeder::class,      // Mon 13 Jul
            RentalDepositBackBlogPostSeeder::class, // Wed 15 Jul
            RentToBuyBlogPostSeeder::class,         // Fri 17 Jul
        ]);
    }
}
