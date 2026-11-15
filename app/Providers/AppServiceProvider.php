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
        // Every alert that rings the bell also goes to the user's devices as a web push
        // (shown by the service worker even when the site is closed).
        \Illuminate\Support\Facades\Event::listen(\Illuminate\Notifications\Events\NotificationSent::class, function ($event) {
            if ($event->channel !== 'database' || ! $event->notifiable instanceof \App\Models\User
                || ! $event->response instanceof \Illuminate\Notifications\DatabaseNotification || ! config('services.webpush.enabled', true)) {
                return;
            }
            $user = $event->notifiable;
            $n = $event->response;
            if (! \App\Models\PushSubscription::where('user_id', $user->id)->exists()) {
                return;
            }
            $f = app(\App\Http\Middleware\HandleInertiaRequests::class)->formatNotification($n->type, (array) $n->data);
            $payload = [
                'title' => mb_substr((string) $f['title'], 0, 80),
                'body'  => mb_substr((string) $f['body'], 0, 140),
                'url'   => $f['href'] ?: '/dashboard',
                'tag'   => 'n-' . $n->id,
            ];
            $send = fn () => app(\App\Services\WebPush\WebPush::class)->toUser($user, $payload);
            // In a web request, push after the response so pages stay fast.
            $this->app->runningInConsole() ? $send() : $this->app->terminating($send);
        });

        // Signing out stops alerts to this device.
        \Illuminate\Support\Facades\Event::listen(\Illuminate\Auth\Events\Logout::class, function ($event) {
            $hash = request()->hasSession() ? request()->session()->get('push_endpoint_hash') : null;
            if ($hash && $event->user) {
                \App\Models\PushSubscription::where('user_id', $event->user->id)->where('endpoint_hash', $hash)->delete();
            }
        });

        Gate::policy(Listing::class, ListingPolicy::class);
        Gate::define('create_sale_listing', [ListingPolicy::class, 'createSale']);

        // Meta WhatsApp webhooks (CRM bulk messaging). Stateless: no session,
        // cookies or CSRF — verified by URL key + Meta's HMAC signature.
        Route::prefix('webhooks/whatsapp')
            ->name('webhooks.whatsapp.')
            ->middleware([\Illuminate\Routing\Middleware\SubstituteBindings::class, 'throttle:600,1'])
            ->group(base_path('routes/whatsapp.php'));

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

        // Same for queued WhatsApp campaigns: send a small batch after a web
        // response, at most once a minute, when something is waiting.
        if (! $this->app->runningInConsole() && ! $this->app->runningUnitTests()
            && config('whatsapp.run_on_requests', true)) {
            $this->app->terminating(function () {
                try {
                    if (\App\Models\WaCampaign::whereIn('status', ['queued', 'sending'])->exists()
                        && Cache::add('whatsapp:last-tick', now()->timestamp, now()->addMinute())) {
                        app(\App\Services\WhatsApp\WhatsAppService::class)->dispatch((int) config('whatsapp.per_request_tick', 40));
                    }
                } catch (\Throwable $e) {
                    report($e);
                }
            });
        }
    }
}
