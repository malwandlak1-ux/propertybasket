<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Inquiry extends Model
{
    protected $fillable = [
        'listing_id', 'listing_unit_id',
        'name', 'email', 'phone', 'message', 'user_id',
        'assigned_to', 'source', 'status',
        'allocated_at', 'allocation_method', 'viewing_scheduled_at',
    ];

    protected function casts(): array
    {
        return [
            'allocated_at' => 'datetime',
            'viewing_scheduled_at' => 'datetime',
        ];
    }

    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(ListingUnit::class, 'listing_unit_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }
}
