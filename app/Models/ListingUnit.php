<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ListingUnit extends Model
{
    protected $fillable = [
        'listing_id', 'unit_number', 'floor',
        'monthly_rent', 'bedrooms', 'bathrooms', 'area_sqm', 'status',
    ];

    protected function casts(): array
    {
        return [
            'monthly_rent' => 'decimal:2',
            'area_sqm' => 'decimal:2',
            'bathrooms' => 'decimal:1',
        ];
    }

    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class);
    }
}
