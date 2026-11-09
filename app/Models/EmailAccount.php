<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A user's own mailbox connected under Messages → Email. Passwords are encrypted at rest. */
class EmailAccount extends Model
{
    public const PROTOCOLS = ['pop3', 'imap'];
    public const ENCRYPTION = ['ssl', 'tls', 'none'];

    protected $fillable = [
        'user_id', 'email', 'display_name', 'protocol', 'incoming_host', 'incoming_port', 'incoming_encryption',
        'username', 'password', 'smtp_host', 'smtp_port', 'smtp_encryption', 'smtp_username', 'smtp_password',
        'last_synced_at', 'last_error',
    ];

    protected $hidden = ['password', 'smtp_password'];

    protected function casts(): array
    {
        return [
            'password' => 'encrypted',
            'smtp_password' => 'encrypted',
            'incoming_port' => 'integer',
            'smtp_port' => 'integer',
            'last_synced_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(EmailMessage::class);
    }

    public function smtpUser(): string
    {
        return $this->smtp_username ?: $this->username;
    }

    public function smtpPass(): string
    {
        return $this->smtp_password ?: $this->password;
    }
}
