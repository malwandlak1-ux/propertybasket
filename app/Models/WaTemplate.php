<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A message template synced from the agent's WhatsApp Business account. */
class WaTemplate extends Model
{
    protected $fillable = [
        'whatsapp_account_id', 'meta_id', 'name', 'language', 'category', 'status',
        'body', 'header', 'footer', 'params', 'components', 'sendable', 'unsupported_reason',
    ];

    protected function casts(): array
    {
        return [
            'params'     => 'array',
            'components' => 'array',
            'sendable'   => 'boolean',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(WhatsAppAccount::class, 'whatsapp_account_id');
    }
}
