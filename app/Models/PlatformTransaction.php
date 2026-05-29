<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class PlatformTransaction extends Model
{
    protected $fillable = [
        'subscriber_type', 'subscriber_id',
        'type', 'amount', 'description',
        'paystack_reference', 'status',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
        ];
    }

    public function subscriber(): MorphTo
    {
        return $this->morphTo();
    }
}
