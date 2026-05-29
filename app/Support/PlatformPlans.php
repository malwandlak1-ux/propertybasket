<?php

namespace App\Support;

use App\Models\PlatformPlan;
use Illuminate\Support\Facades\Schema;

/**
 * Single source of truth for platform subscription plans.
 *
 * Plans live in the `platform_plans` DB table so super-admins can edit pricing
 * and features at runtime; the constants below are the seed defaults that get
 * imported on first migrate via PlatformPlansSeeder.
 */
class PlatformPlans
{
    public const LANDLORD_PRIVATE = 'landlord_private';
    public const STARTER          = 'starter';
    public const GROWTH           = 'growth';
    public const ENTERPRISE       = 'enterprise';

    /** Contractor platform fee — charged per completed job invoice. */
    public const CONTRACTOR_FEE_PERCENT = 2.5;

    /**
     * Hard-coded defaults — used by the seeder and as a fallback when the
     * platform_plans table is missing / empty (e.g. during fresh tests).
     *
     * @return array<string, array{key:string, name:string, audience:string, price:int, headline:string, features:string[], popular?:bool}>
     */
    public static function defaults(): array
    {
        return [
            self::LANDLORD_PRIVATE => [
                'key' => self::LANDLORD_PRIVATE, 'name' => 'Private Landlord',
                'audience' => 'landlord', 'price' => 149, 'headline' => 'Up to 5 properties',
                'features' => ['5 properties max', 'Tenant + contractor invites', 'Inspections & maintenance'],
            ],
            self::STARTER => [
                'key' => self::STARTER, 'name' => 'Agency · Starter',
                'audience' => 'agency', 'price' => 499, 'headline' => 'Up to 5 agents',
                'features' => ['5 agents', 'Unlimited listings', 'Trust account + VAT'],
            ],
            self::GROWTH => [
                'key' => self::GROWTH, 'name' => 'Agency · Growth',
                'audience' => 'agency', 'price' => 1_299, 'headline' => 'Up to 20 agents',
                'popular' => true,
                'features' => ['20 agents', 'Advanced analytics', 'Lead allocation engine'],
            ],
            self::ENTERPRISE => [
                'key' => self::ENTERPRISE, 'name' => 'Agency · Enterprise',
                'audience' => 'agency', 'price' => 3_499, 'headline' => 'Unlimited agents',
                'features' => ['Unlimited agents', 'White-label branding', 'Priority support + API'],
            ],
        ];
    }

    /**
     * Live plans, keyed by `key`. Falls back to defaults when the DB table is
     * unavailable so the rest of the app keeps working in odd states.
     */
    public static function all(): array
    {
        if (! Schema::hasTable('platform_plans')) {
            return self::defaults();
        }

        $rows = PlatformPlan::where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        if ($rows->isEmpty()) {
            return self::defaults();
        }

        return $rows->keyBy('key')->map(fn ($p) => [
            'key'      => $p->key,
            'name'     => $p->name,
            'audience' => $p->audience,
            'price'    => (int) $p->price,
            'headline' => $p->headline,
            'features' => $p->features ?? [],
            'popular'  => (bool) $p->is_popular,
        ])->all();
    }

    public static function priceFor(string $key): int
    {
        return self::all()[$key]['price'] ?? 0;
    }
}
