<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One line on a landlord's facility operations ledger: an operating expense
 * or other income. Separate from rent and maintenance by design.
 */
class FacilityEntry extends Model
{
    protected $fillable = [
        'landlord_id', 'listing_id', 'type', 'category', 'description', 'amount', 'entry_date',
        'counterparty', 'reference', 'notes', 'attachment_path', 'attachment_name', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'amount'     => 'decimal:2',
            'entry_date' => 'date',
        ];
    }

    public function landlord(): BelongsTo
    {
        return $this->belongsTo(Landlord::class);
    }

    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class);
    }
}
