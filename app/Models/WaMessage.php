<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One WhatsApp message, out (template / reply) or in (owner's message). */
class WaMessage extends Model
{
    /** Delivery statuses only ever move forward. */
    public const RANK = ['queued' => 0, 'sent' => 1, 'delivered' => 2, 'read' => 3];

    protected $fillable = [
        'whatsapp_account_id', 'agent_id', 'wa_campaign_id', 'crm_prospect_id',
        'direction', 'type', 'phone', 'body', 'media_path', 'media_name', 'media_mime', 'variables', 'wamid', 'status',
        'error_code', 'error_message', 'sent_at', 'delivered_at', 'read_at', 'failed_at', 'replied_at',
    ];

    protected function casts(): array
    {
        return [
            'variables'    => 'array',
            'sent_at'      => 'datetime',
            'delivered_at' => 'datetime',
            'read_at'      => 'datetime',
            'failed_at'    => 'datetime',
            'replied_at'   => 'datetime',
        ];
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(WaCampaign::class, 'wa_campaign_id');
    }

    public function prospect(): BelongsTo
    {
        return $this->belongsTo(CrmProspect::class, 'crm_prospect_id');
    }
}
