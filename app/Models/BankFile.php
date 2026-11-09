<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One file sent to / received from the bank over a host-to-host link (audit trail). */
class BankFile extends Model
{
    protected $fillable = ['bank_link_id', 'payout_batch_id', 'direction', 'name', 'message_id', 'kind', 'storage_path', 'summary'];

    public function link(): BelongsTo
    {
        return $this->belongsTo(BankLink::class, 'bank_link_id');
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(PayoutBatch::class, 'payout_batch_id');
    }
}
