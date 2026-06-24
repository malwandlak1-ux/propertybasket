<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Landlord;
use App\Models\PromoCode;
use App\Support\PlatformPlans;
use Illuminate\Database\Seeder;

class PromoCodesSeeder extends Seeder
{
    public function run(): void
    {
        // ── Sample promo codes (full free access for a fixed window) ──────
        $codes = [
            ['code' => 'PBLAUNCH',  'description' => 'Launch promo — 3 months free', 'audience' => 'both',     'duration_days' => 90],
            ['code' => 'AGENCY30',  'description' => 'Agency 30-day trial',           'audience' => 'agency',   'duration_days' => 30],
            ['code' => 'LANDLORD60','description' => 'Landlord 60-day trial',         'audience' => 'landlord', 'duration_days' => 60],
        ];

        foreach ($codes as $c) {
            PromoCode::updateOrCreate(
                ['code' => $c['code']],
                $c + ['is_active' => true],
            );
        }

        // ── Grandfather existing accounts ────────────────────────────────
        // Any agency / landlord without an active subscription gets one so the
        // paywall doesn't lock existing demo logins out of their dashboard.
        Agency::query()
            ->where(fn ($q) => $q->whereNull('subscription_plan')->orWhereNull('subscription_expires_at'))
            ->get()
            ->each(function (Agency $a) {
                $a->forceFill([
                    'subscription_plan'       => $a->subscription_plan ?: PlatformPlans::STARTER,
                    'subscription_expires_at' => now()->addYear(),
                ])->save();
            });

        Landlord::query()
            ->where(fn ($q) => $q->whereNull('subscription_plan')->orWhereNull('subscription_expires_at'))
            ->get()
            ->each(function (Landlord $l) {
                $l->forceFill([
                    'subscription_plan'       => $l->subscription_plan ?: PlatformPlans::LANDLORD_PRIVATE,
                    'subscription_expires_at' => now()->addYear(),
                ])->save();
            });

        $this->command->info('Promo codes seeded; existing agencies & landlords grandfathered with active subscriptions.');
    }
}
