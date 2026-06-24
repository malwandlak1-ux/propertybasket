<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

class PromoCode extends Model
{
    protected $fillable = [
        'code', 'description', 'audience',
        'duration_days', 'max_redemptions', 'times_redeemed',
        'valid_until', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'duration_days'   => 'integer',
            'max_redemptions' => 'integer',
            'times_redeemed'  => 'integer',
            'valid_until'     => 'date',
            'is_active'       => 'boolean',
        ];
    }

    public function redemptions(): HasMany
    {
        return $this->hasMany(PromoCodeRedemption::class);
    }

    /**
     * Reasons a code may be unusable, independent of any specific user.
     * Returns null when the code itself is currently redeemable.
     */
    public function generalRejection(): ?string
    {
        if (! $this->is_active) {
            return 'This promo code is no longer active.';
        }
        if ($this->valid_until && $this->valid_until->endOfDay()->isPast()) {
            return 'This promo code has expired.';
        }
        if ($this->max_redemptions !== null && $this->times_redeemed >= $this->max_redemptions) {
            return 'This promo code has reached its redemption limit.';
        }
        return null;
    }

    public function appliesToAudience(string $audience): bool
    {
        return $this->audience === 'both' || $this->audience === $audience;
    }

    /** When access would expire if this code were redeemed right now. */
    public function accessExpiryFromNow(): Carbon
    {
        return now()->addDays($this->duration_days);
    }
}
