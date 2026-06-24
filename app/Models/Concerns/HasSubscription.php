<?php

namespace App\Models\Concerns;

use Illuminate\Support\Carbon;

/**
 * Shared subscription state for billable owner models (Agency, Landlord).
 *
 * Both tables carry `subscription_plan` (string|null) and
 * `subscription_expires_at` (datetime|null). A subscription is "active" when a
 * plan is set and the expiry is in the future. Promo-granted access uses the
 * sentinel plan key `promo`.
 */
trait HasSubscription
{
    public const PROMO_PLAN_KEY = 'promo';

    public function hasActiveSubscription(): bool
    {
        return ! empty($this->subscription_plan)
            && $this->subscription_expires_at !== null
            && $this->subscription_expires_at->isFuture();
    }

    public function subscriptionExpired(): bool
    {
        return ! empty($this->subscription_plan)
            && $this->subscription_expires_at !== null
            && $this->subscription_expires_at->isPast();
    }

    public function isPromoSubscription(): bool
    {
        return $this->subscription_plan === self::PROMO_PLAN_KEY;
    }

    /** Whole days until the subscription lapses (negative if already past). */
    public function subscriptionDaysRemaining(): ?int
    {
        if ($this->subscription_expires_at === null) {
            return null;
        }
        return (int) round(now()->startOfDay()->diffInDays(
            $this->subscription_expires_at->copy()->startOfDay(),
            false
        ));
    }

    public function activateSubscription(string $planKey, Carbon $expiresAt): void
    {
        $this->forceFill([
            'subscription_plan'       => $planKey,
            'subscription_expires_at' => $expiresAt,
        ])->save();
    }
}
