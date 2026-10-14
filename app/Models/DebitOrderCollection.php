<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DebitOrderCollection extends Model
{
    protected $fillable = [
        'debit_order_id', 'lease_id', 'rent_payment_id', 'amount', 'reference',
        'status', 'failure_reason', 'attempted_at', 'settled_at',
    ];

    protected function casts(): array
    {
        return [
            'amount'       => 'decimal:2',
            'attempted_at' => 'datetime',
            'settled_at'   => 'datetime',
        ];
    }

    public function debitOrder(): BelongsTo
    {
        return $this->belongsTo(DebitOrder::class);
    }

    public function lease(): BelongsTo
    {
        return $this->belongsTo(Lease::class);
    }

    public function rentPayment(): BelongsTo
    {
        return $this->belongsTo(RentPayment::class);
    }
}
