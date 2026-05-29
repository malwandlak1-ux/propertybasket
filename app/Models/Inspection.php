<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Inspection extends Model
{
    protected $fillable = [
        'lease_id', 'type', 'conducted_by', 'tenant_id', 'status',
        'rooms', 'agent_signed_at', 'agent_signature',
        'tenant_signed_at', 'tenant_signature',
        'pdf_path', 'deduction_total',
    ];

    protected function casts(): array
    {
        return [
            'rooms' => 'array',
            'agent_signed_at' => 'datetime',
            'tenant_signed_at' => 'datetime',
            'deduction_total' => 'decimal:2',
        ];
    }

    public function lease(): BelongsTo
    {
        return $this->belongsTo(Lease::class);
    }

    public function conductor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'conducted_by');
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'tenant_id');
    }

    public function deductions(): HasMany
    {
        return $this->hasMany(InspectionDeduction::class);
    }
}
