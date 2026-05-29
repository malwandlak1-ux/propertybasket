<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MaintenanceQuote extends Model
{
    protected $fillable = [
        'maintenance_request_id', 'contractor_id',
        'line_items', 'subtotal', 'vat_amount', 'total',
        'vat_registered', 'notes', 'valid_until', 'status',
        'sent_at', 'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'line_items' => 'array',
            'vat_registered' => 'boolean',
            'subtotal' => 'decimal:2',
            'vat_amount' => 'decimal:2',
            'total' => 'decimal:2',
            'valid_until' => 'date',
            'sent_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public function request(): BelongsTo
    {
        return $this->belongsTo(MaintenanceRequest::class, 'maintenance_request_id');
    }

    public function contractor(): BelongsTo
    {
        return $this->belongsTo(Contractor::class);
    }
}
