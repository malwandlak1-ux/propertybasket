<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class MaintenanceRequest extends Model
{
    protected $fillable = [
        'property_id', 'lease_id', 'submitted_by',
        'title', 'description', 'category', 'urgency',
        'preferred_date', 'preferred_time_slot', 'photos',
        'assigned_to', 'status', 'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'photos' => 'array',
            'preferred_date' => 'date',
            'completed_at' => 'datetime',
        ];
    }

    public function property(): BelongsTo
    {
        return $this->belongsTo(Listing::class, 'property_id');
    }

    public function lease(): BelongsTo
    {
        return $this->belongsTo(Lease::class);
    }

    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function contractor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function quotes(): HasMany
    {
        return $this->hasMany(MaintenanceQuote::class);
    }

    public function invoice(): HasOne
    {
        return $this->hasOne(MaintenanceInvoice::class);
    }
}
