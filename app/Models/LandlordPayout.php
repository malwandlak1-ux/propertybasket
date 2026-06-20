<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LandlordPayout extends Model
{
    protected $fillable = [
        'agency_id', 'managed_landlord_id', 'listing_id', 'lease_id', 'agent_id',
        'period_month', 'rent_amount', 'landlord_amount', 'agency_amount',
        'agent_amount', 'status', 'payout_method', 'paid_at',
    ];

    protected function casts(): array
    {
        return [
            'period_month' => 'date',
            'paid_at' => 'datetime',
            'rent_amount' => 'decimal:2',
            'landlord_amount' => 'decimal:2',
            'agency_amount' => 'decimal:2',
            'agent_amount' => 'decimal:2',
        ];
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function managedLandlord(): BelongsTo
    {
        return $this->belongsTo(ManagedLandlord::class);
    }

    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class);
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'agent_id');
    }
}
