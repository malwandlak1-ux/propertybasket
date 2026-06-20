<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Listing extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'ulid', 'owner_type', 'owner_id', 'agent_id',
        'managed_landlord_id', 'landlord_split_percent', 'agency_split_percent', 'agent_split_percent',
        'title', 'slug', 'description',
        'listing_type', 'property_type', 'status',
        'sale_price', 'negotiator_protocol',
        'monthly_rent', 'listing_structure',
        'short_stay_nightly_price', 'short_stay_max_guests', 'short_stay_cleaning_fee',
        'address', 'suburb', 'city', 'province', 'postal_code', 'latitude', 'longitude',
        'bedrooms', 'bathrooms', 'area_sqm', 'amenities',
        'primary_image', 'gallery_images',
        'views_count', 'inquiries_count',
        'deactivated_reason', 'reactivated_at',
    ];

    protected function casts(): array
    {
        return [
            'amenities' => 'array',
            'gallery_images' => 'array',
            'negotiator_protocol' => 'boolean',
            'sale_price' => 'decimal:2',
            'monthly_rent' => 'decimal:2',
            'landlord_split_percent' => 'decimal:2',
            'agency_split_percent' => 'decimal:2',
            'agent_split_percent' => 'decimal:2',
            'short_stay_nightly_price' => 'decimal:2',
            'short_stay_cleaning_fee' => 'decimal:2',
            'area_sqm' => 'decimal:2',
            'bathrooms' => 'decimal:1',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'reactivated_at' => 'datetime',
        ];
    }

    public function owner(): MorphTo
    {
        return $this->morphTo();
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'agent_id');
    }

    public function managedLandlord(): BelongsTo
    {
        return $this->belongsTo(ManagedLandlord::class);
    }

    public function units(): HasMany
    {
        return $this->hasMany(ListingUnit::class);
    }

    public function inquiries(): HasMany
    {
        return $this->hasMany(Inquiry::class);
    }

    public function leases(): HasMany
    {
        return $this->hasMany(Lease::class);
    }

    public function maintenanceRequests(): HasMany
    {
        return $this->hasMany(MaintenanceRequest::class, 'property_id');
    }
}
