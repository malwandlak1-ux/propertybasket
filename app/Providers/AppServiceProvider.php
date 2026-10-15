<?php

namespace App\Providers;

use App\Models\Listing;
use App\Policies\ListingPolicy;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;
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

        // Integration API (another system pulls a landlord's statements with
        // an API key). Stateless: no session, cookies or CSRF.
        Route::prefix('api/integration/v1')
            ->name('integration.')
            ->middleware([
                \Illuminate\Routing\Middleware\SubstituteBindings::class,
                \App\Http\Middleware\AuthenticateApiKey::class,
                'throttle:120,1',
            ])
            ->group(base_path('routes/integration.php'));

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
