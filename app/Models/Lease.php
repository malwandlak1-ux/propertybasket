<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Lease extends Model
{
    protected $fillable = [
        'listing_id', 'listing_unit_id', 'tenant_id', 'landlord_id',
        'agency_id', 'agent_id',
        'start_date', 'end_date', 'monthly_rent', 'deposit_amount',
        'deposit_interest_rate', 'escalation_percent', 'notice_period_days',
        'status', 'signed_at', 'document_path',
        'tenant_signed_at', 'tenant_signature',
        'late_fee_enabled', 'late_fee_type', 'late_fee_value', 'late_fee_day', 'late_fee_since',
        'payment_reference',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'signed_at' => 'datetime',
            'tenant_signed_at' => 'datetime',
            'monthly_rent' => 'decimal:2',
            'deposit_amount' => 'decimal:2',
            'deposit_interest_rate' => 'decimal:2',
            'escalation_percent' => 'decimal:2',
            'late_fee_enabled' => 'boolean',
            'late_fee_value' => 'decimal:2',
            'late_fee_day' => 'integer',
            'late_fee_since' => 'date',
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

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'tenant_id');
    }

    public function landlord(): BelongsTo
    {
        return $this->belongsTo(User::class, 'landlord_id');
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'agent_id');
    }

    public function rentPayments(): HasMany
    {
        return $this->hasMany(RentPayment::class);
    }

    public function deposit(): HasOne
    {
        return $this->hasOne(Deposit::class);
    }

    public function inspections(): HasMany
    {
        return $this->hasMany(Inspection::class);
    }

    /** Human description of the late-payment penalty, e.g. "10% of rent if not paid by the 10th". */
    public function lateFeeSummary(): ?string
    {
        if (! $this->late_fee_enabled || (float) $this->late_fee_value <= 0) {
            return null;
        }
        $day = (int) $this->late_fee_day;
        $suffix = in_array($day % 100, [11, 12, 13], true) ? 'th' : (['th', 'st', 'nd', 'rd'][$day % 10] ?? 'th');
        $fee = $this->late_fee_type === 'fixed'
            ? 'R ' . number_format((float) $this->late_fee_value, 0, '.', ',')
            : rtrim(rtrim(number_format((float) $this->late_fee_value, 2, '.', ''), '0'), '.') . '% of rent';

        return "{$fee} if not paid by the {$day}{$suffix}";
    }
}
