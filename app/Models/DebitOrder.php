<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DebitOrder extends Model
{
    protected $fillable = [
        'lease_id', 'tenant_id',
        'bank_name', 'account_holder', 'account_number', 'branch_code', 'account_type',
        'debit_day', 'status',
        'signed_at', 'cancelled_at',
    ];

    protected function casts(): array
    {
        return [
            'signed_at'    => 'datetime',
            'cancelled_at' => 'datetime',
            'debit_day'    => 'integer',
        ];
    }

    public function lease(): BelongsTo
    {
        return $this->belongsTo(Lease::class);
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'tenant_id');
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }
}
