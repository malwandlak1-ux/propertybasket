<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EftPayment extends Model
{
    protected $fillable = [
        'lease_id', 'rent_payment_id', 'tenant_id', 'amount', 'paid_on', 'reference',
        'proof_path', 'note', 'status', 'reviewed_by', 'reviewed_at', 'reject_reason',
    ];

    protected function casts(): array
    {
        return [
            'amount'      => 'decimal:2',
            'paid_on'     => 'date',
            'reviewed_at' => 'datetime',
        ];
    }

    public function lease(): BelongsTo
    {
        return $this->belongsTo(Lease::class);
    }

    public function rentPayment(): BelongsTo
    {
        return $this->belongsTo(RentPayment::class);
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'tenant_id');
    }
}
