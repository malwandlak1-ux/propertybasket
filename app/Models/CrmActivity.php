<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One outreach touch (or a batch, via quantity — e.g. "350 SMS sent") on a
 * channel. Feeds the CRM outreach statistics.
 */
class CrmActivity extends Model
{
    protected $fillable = ['agency_id', 'agent_id', 'crm_prospect_id', 'channel', 'outcome', 'quantity', 'note', 'occurred_on'];

    protected function casts(): array
    {
        return [
            'occurred_on' => 'date',
            'quantity'    => 'integer',
        ];
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'agent_id');
    }

    public function prospect(): BelongsTo
    {
        return $this->belongsTo(CrmProspect::class, 'crm_prospect_id');
    }
}
