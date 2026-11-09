<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmailMessage extends Model
{
    protected $fillable = [
        'email_account_id', 'folder', 'uid', 'message_id', 'in_reply_to', 'from_email', 'from_name', 'to', 'cc',
        'subject', 'body_text', 'body_html', 'attachments', 'received_at', 'read_at',
    ];

    protected function casts(): array
    {
        return [
            'to' => 'array',
            'cc' => 'array',
            'attachments' => 'array',
            'received_at' => 'datetime',
            'read_at' => 'datetime',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(EmailAccount::class, 'email_account_id');
    }
}
