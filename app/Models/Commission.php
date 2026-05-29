<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Commission extends Model
{
    protected $fillable = [
        'agency_id', 'agent_id', 'deal_type',
        'listing_id', 'lease_id', 'deal_value', 'gross_commission',
        'agent_split_percent', 'agent_amount', 'agency_amount',
        'vat_amount', 'agent_net',
        'paystack_transfer_id', 'status', 'blocked_reason',
        'payout_batch_id', 'payout_batch_date', 'paid_at',
    ];

    protected function casts(): array
    {
        return [
            'paid_at' => 'datetime',
            'payout_batch_date' => 'date',
            'deal_value' => 'decimal:2',
            'gross_commission' => 'decimal:2',
            'agent_split_percent' => 'decimal:2',
            'agent_amount' => 'decimal:2',
            'agency_amount' => 'decimal:2',
            'vat_amount' => 'decimal:2',
            'agent_net' => 'decimal:2',
        ];
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'agent_id');
    }

    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class);
    }

    public function lease(): BelongsTo
    {
        return $this->belongsTo(Lease::class);
    }

    public function payoutBatch(): BelongsTo
    {
        return $this->belongsTo(PayoutBatch::class);
    }
}
