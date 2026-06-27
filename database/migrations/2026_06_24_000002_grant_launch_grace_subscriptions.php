<?php

use App\Models\Agency;
use App\Models\Landlord;
use Illuminate\Database\Migrations\Migration;

/**
 * Paywall launch safeguard. The new EnsureSubscribed middleware bounces agencies
 * and landlords without an active subscription to the plan-selection page. To
 * avoid locking out accounts that already existed before the paywall went live,
 * grant them two years of promo ("grace") access. Runs once, during deploy, so
 * there is no lockout window. New sign-ups after launch are unaffected.
 */
return new class extends Migration
{
    public function up(): void
    {
        $grantUntil = now()->addYears(2);

        foreach (Agency::all() as $agency) {
            if (! $agency->hasActiveSubscription()) {
                $agency->forceFill([
                    'subscription_plan'       => Agency::PROMO_PLAN_KEY,
                    'subscription_expires_at' => $grantUntil,
                ])->save();
            }
        }

        foreach (Landlord::all() as $landlord) {
            if (! $landlord->hasActiveSubscription()) {
                $landlord->forceFill([
                    'subscription_plan'       => Landlord::PROMO_PLAN_KEY,
                    'subscription_expires_at' => $grantUntil,
                ])->save();
            }
        }
    }

    public function down(): void
    {
        // No-op: a data backfill is not reversed.
    }
};
