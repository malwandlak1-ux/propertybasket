<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class PromoCodeRedemption extends Model
{
    protected $fillable = [
        'promo_code_id', 'user_id',
        'subscriber_type', 'subscriber_id',
        'access_expires_at',
    ];

    protected function casts(): array
    {
        return [
            'access_expires_at' => 'datetime',
        ];
    }

    public function promoCode(): BelongsTo
    {
        return $this->belongsTo(PromoCode::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function subscriber(): MorphTo
    {
        return $this->morphTo();
    }
}
