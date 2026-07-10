<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Deposit extends Model
{
    public const STATUS_DUE  = 'due';
    public const STATUS_HELD = 'held';

    protected $fillable = [
        'lease_id', 'amount_deposited', 'deposited_at',
        'interest_rate', 'accrued_interest', 'last_accrual_date',
        'deductions', 'refund_amount', 'refunded_at',
        'paystack_reference', 'status', 'marked_received_by',
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

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'marked_received_by');
    }

    public function isDue(): bool
    {
        return $this->status === self::STATUS_DUE;
    }

    public function isHeld(): bool
    {
        return $this->status === self::STATUS_HELD;
    }

    /**
     * Mark the deposit as received into the agency trust account.
     * PPRA interest starts accruing from the day it is received.
     */
    public function markReceived(?int $userId = null): void
    {
        $this->status            = self::STATUS_HELD;
        $this->deposited_at      = $this->deposited_at ?? now();
        $this->last_accrual_date = now()->toDateString();
        $this->marked_received_by = $userId;
        $this->save();
    }
}
