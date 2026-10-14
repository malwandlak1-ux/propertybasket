<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RentPayment extends Model
{
    protected $fillable = [
        'lease_id', 'amount', 'period_month',
        'due_date', 'paid_at', 'payment_method',
        'paystack_reference', 'paystack_transaction_id',
        'status', 'receipt_path',
        'late_fee', 'late_fee_applied_at', 'late_fee_waived_at',
    ];

    protected function casts(): array
    {
        return [
            'due_date' => 'date',
            'paid_at' => 'datetime',
            'amount' => 'decimal:2',
            'late_fee' => 'decimal:2',
            'late_fee_applied_at' => 'datetime',
            'late_fee_waived_at' => 'datetime',
        ];
    }

    public function lease(): BelongsTo
    {
        return $this->belongsTo(Lease::class);
    }

    public function eftPayments(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(EftPayment::class);
    }
}
