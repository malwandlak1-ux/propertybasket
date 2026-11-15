<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** An agency's host-to-host link with its bank (see the bank_links migration). */
class BankLink extends Model
{
    /** Onboarding stages, in order. */
    public const STAGES = ['requested', 'agreement', 'credentials', 'testing', 'live', 'paused'];

    protected $fillable = [
        'agency_id', 'bank', 'status', 'contact_name', 'contact_email', 'contact_phone', 'banker_name', 'banker_email', 'notes',
        'client_code', 'sftp_host', 'sftp_port', 'sftp_username', 'sftp_password', 'sftp_private_key', 'upload_dir', 'download_dir',
        'requested_at', 'live_at', 'last_polled_at', 'last_error',
    ];

    protected $hidden = ['sftp_password', 'sftp_private_key'];

    protected function casts(): array
    {
        return [
            'sftp_password'    => 'encrypted',
            'sftp_private_key' => 'encrypted',
            'sftp_port'        => 'integer',
            'requested_at'     => 'datetime',
            'live_at'          => 'datetime',
            'last_polled_at'   => 'datetime',
        ];
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function files(): HasMany
    {
        return $this->hasMany(BankFile::class);
    }

    /** Payouts can go through the link (live, or testing against the bank's test server). */
    public function canSend(): bool
    {
        return in_array($this->status, ['testing', 'live'], true) && filled($this->sftp_host) && filled($this->sftp_username)
            && (filled($this->sftp_password) || filled($this->sftp_private_key));
    }

    public function bankName(): string
    {
        return \App\Services\Banking\H2H\BankProfile::for($this->bank)->name;
    }
}
