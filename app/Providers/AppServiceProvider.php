<?php

namespace App\Providers;

use App\Models\Listing;
use App\Policies\ListingPolicy;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Gate::policy(Listing::class, ListingPolicy::class);
        Gate::define('create_sale_listing', [ListingPolicy::class, 'createSale']);

        // Debit orders shouldn't depend on the host running the scheduler cron:
        // after a web response has been sent, check for due collections at
        // most every 15 minutes.
        if (! $this->app->runningInConsole() && ! $this->app->runningUnitTests()
            && config('services.debit_orders.run_on_requests', true)) {
            $this->app->terminating(function () {
                try {
                    if (Cache::add('debit-orders:last-check', now()->timestamp, now()->addMinutes(15))) {
                        app(\App\Services\DebitOrderCollector::class)->run();
                    }
                } catch (\Throwable $e) {
                    report($e);
                }
            });
        }
    }
}
