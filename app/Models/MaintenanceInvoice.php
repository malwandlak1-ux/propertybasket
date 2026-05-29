<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MaintenanceInvoice extends Model
{
    protected $fillable = [
        'maintenance_request_id', 'quote_id', 'contractor_id',
        'line_items', 'original_quote_total',
        'invoice_subtotal', 'vat_amount', 'invoice_total',
        'deviation_amount', 'deviation_notes',
        'completion_photos', 'supporting_documents',
        'paystack_reference', 'status',
        'submitted_at', 'approved_at', 'paid_at',
    ];

    protected function casts(): array
    {
        return [
            'line_items' => 'array',
            'completion_photos' => 'array',
            'supporting_documents' => 'array',
            'submitted_at' => 'datetime',
            'approved_at' => 'datetime',
            'paid_at' => 'datetime',
            'invoice_subtotal' => 'decimal:2',
            'vat_amount' => 'decimal:2',
            'invoice_total' => 'decimal:2',
            'original_quote_total' => 'decimal:2',
            'deviation_amount' => 'decimal:2',
        ];
    }

    public function request(): BelongsTo
    {
        return $this->belongsTo(MaintenanceRequest::class, 'maintenance_request_id');
    }

    public function quote(): BelongsTo
    {
        return $this->belongsTo(MaintenanceQuote::class, 'quote_id');
    }

    public function contractor(): BelongsTo
    {
        return $this->belongsTo(Contractor::class);
    }
}
