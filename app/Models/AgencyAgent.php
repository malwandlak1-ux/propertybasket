<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AgencyAgent extends Model
{
    protected $fillable = [
        'agency_id', 'user_id',
        'commission_split_percent', 'area_speciality', 'property_type_speciality',
        'ffc_number', 'ffc_expires_at', 'ffc_certificate_path', 'ffc_reminder_sent_at',
        'lead_allocation_position', 'status',
    ];

    protected function casts(): array
    {
        return [
            'area_speciality' => 'array',
            'property_type_speciality' => 'array',
            'ffc_expires_at' => 'date',
            'ffc_reminder_sent_at' => 'datetime',
            'commission_split_percent' => 'decimal:2',
        ];
    }

    /**
     * True when the agent has both an FFC number on file and the cert hasn't expired.
     * Mirrors the gate used by EnsureValidFfc + the agent dashboard banner.
     */
    public function hasValidFfc(): bool
    {
        return ! empty($this->ffc_number)
            && $this->ffc_expires_at !== null
            && ! $this->ffc_expires_at->isPast();
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
