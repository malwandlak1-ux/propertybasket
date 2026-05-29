<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Deposit extends Model
{
    protected $fillable = [
        'lease_id', 'amount_deposited', 'deposited_at',
        'interest_rate', 'accrued_interest', 'last_accrual_date',
        'deductions', 'refund_amount', 'refunded_at',
        'paystack_reference', 'status',
    ];

    protected function casts(): array
    {
        return [
            'deductions' => 'array',
            'deposited_at' => 'datetime',
            'refunded_at' => 'datetime',
            'last_accrual_date' => 'date',
            'amount_deposited' => 'decimal:2',
            'accrued_interest' => 'decimal:2',
            'refund_amount' => 'decimal:2',
            'interest_rate' => 'decimal:2',
        ];
    }

    public function lease(): BelongsTo
    {
        return $this->belongsTo(Lease::class);
    }
}
