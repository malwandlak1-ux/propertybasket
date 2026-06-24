<?php

namespace App\Models;

use App\Models\Concerns\HasSubscription;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Agency extends Model
{
    use HasSubscription, SoftDeletes;

    protected $fillable = [
        'user_id', 'name', 'slug', 'logo', 'website', 'email', 'phone',
        'head_office_address', 'eaab_ffc_number', 'eaab_verified_at',
        'eaab_ffc_expires_at', 'eaab_ffc_certificate_path', 'eaab_reminder_sent_at',
        'vat_registered', 'vat_number', 'vat_rate',
        'sale_commission_percent', 'rental_commission_percent',
        'paystack_subaccount_code', 'trust_bank', 'trust_account_number',
        'trust_branch_code', 'trust_account_holder', 'trust_account_type',
        'trust_auditor_name', 'trust_auditor_practice_number', 'trust_verified_at',
        'payout_day', 'status',
        'subscription_plan', 'subscription_expires_at',
    ];

    protected function casts(): array
    {
        return [
            'vat_registered' => 'boolean',
            'vat_rate' => 'decimal:2',
            'sale_commission_percent' => 'decimal:2',
            'rental_commission_percent' => 'decimal:2',
            'eaab_verified_at' => 'datetime',
            'eaab_ffc_expires_at' => 'date',
            'eaab_reminder_sent_at' => 'datetime',
            'trust_verified_at' => 'datetime',
            'subscription_expires_at' => 'datetime',
        ];
    }

    /**
     * True when the agency has an FFC number on file with a future expiry —
     * mirrors the gate used by EnsureValidAgencyFfc + the dashboard banner.
     */
    public function hasValidFfc(): bool
    {
        return ! empty($this->eaab_ffc_number)
            && $this->eaab_ffc_expires_at !== null
            && ! $this->eaab_ffc_expires_at->isPast();
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function agents(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'agency_agents')
            ->withPivot([
                'commission_split_percent', 'area_speciality', 'property_type_speciality',
                'ffc_number', 'ffc_expires_at', 'lead_allocation_position', 'status',
            ])
            ->withTimestamps();
    }

    public function listings(): MorphMany
    {
        return $this->morphMany(Listing::class, 'owner');
    }

    public function leases(): HasMany
    {
        return $this->hasMany(Lease::class);
    }

    public function payoutBatches(): HasMany
    {
        return $this->hasMany(PayoutBatch::class);
    }
}
