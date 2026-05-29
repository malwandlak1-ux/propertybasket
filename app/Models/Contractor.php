<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Contractor extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'user_id', 'created_by_agency_id', 'business_name', 'trading_name', 'bio',
        'specialities', 'service_areas',
        'vat_registered', 'vat_number', 'paystack_recipient_code',
        'bank_name', 'bank_account_holder', 'bank_account_number',
        'bank_branch_code', 'bank_account_type', 'bank_verified_at',
        'cipc_number', 'cipc_verified_at',
        'tax_clearance_path', 'tax_clearance_verified_at',
        'bbbee_level', 'bbbee_path', 'bbbee_verified_at',
        'insurance_amount', 'insurance_path', 'insurance_verified_at',
        'certifications', 'portfolio_items',
        'average_rating', 'total_reviews', 'total_jobs',
        'status', 'platform_fee_percent',
    ];

    protected function casts(): array
    {
        return [
            'specialities' => 'array',
            'service_areas' => 'array',
            'certifications' => 'array',
            'portfolio_items' => 'array',
            'vat_registered' => 'boolean',
            'cipc_verified_at' => 'datetime',
            'tax_clearance_verified_at' => 'datetime',
            'bbbee_verified_at' => 'datetime',
            'insurance_verified_at' => 'datetime',
            'bank_verified_at' => 'datetime',
            'average_rating' => 'decimal:2',
        ];
    }

    public function hasBankingDetails(): bool
    {
        return $this->bank_name
            && $this->bank_account_holder
            && $this->bank_account_number
            && $this->bank_branch_code
            && $this->bank_account_type;
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function ratings(): HasMany
    {
        return $this->hasMany(ContractorRating::class);
    }

    public function quotes(): HasMany
    {
        return $this->hasMany(MaintenanceQuote::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(MaintenanceInvoice::class);
    }
}
