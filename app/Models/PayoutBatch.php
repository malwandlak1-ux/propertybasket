<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PayoutBatch extends Model
{
    protected $fillable = [
        'agency_id', 'batch_date',
        'total_gross', 'total_vat', 'total_agent_net',
        'paystack_bulk_transfer_id', 'status',
    ];

    protected function casts(): array
    {
        return [
            'batch_date' => 'date',
            'total_gross' => 'decimal:2',
            'total_vat' => 'decimal:2',
            'total_agent_net' => 'decimal:2',
        ];
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function commissions(): HasMany
    {
        return $this->hasMany(Commission::class);
    }
}
