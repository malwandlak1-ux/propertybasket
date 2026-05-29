<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InspectionDeduction extends Model
{
    protected $fillable = [
        'inspection_id', 'room', 'description', 'amount',
        'approved_at', 'disputed_at',
    ];

    protected function casts(): array
    {
        return [
            'approved_at' => 'datetime',
            'disputed_at' => 'datetime',
            'amount' => 'decimal:2',
        ];
    }

    public function inspection(): BelongsTo
    {
        return $this->belongsTo(Inspection::class);
    }
}
