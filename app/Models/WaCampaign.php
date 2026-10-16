<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A bulk WhatsApp send of one approved template to a list of CRM owners. */
class WaCampaign extends Model
{
    protected $fillable = [
        'agency_id', 'agent_id', 'whatsapp_account_id', 'wa_template_id', 'name',
        'template_name', 'template_language', 'variable_map', 'status', 'pause_reason',
        'total', 'scheduled_at', 'started_at', 'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'variable_map' => 'array',
            'scheduled_at' => 'datetime',
            'started_at'   => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(WhatsAppAccount::class, 'whatsapp_account_id');
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(WaTemplate::class, 'wa_template_id');
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'agent_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(WaMessage::class);
    }
}
