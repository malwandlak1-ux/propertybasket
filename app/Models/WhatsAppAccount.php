<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * An agent's own WhatsApp Business (Cloud API) number. Credentials are
 * encrypted at rest and never sent to the browser.
 */
class WhatsAppAccount extends Model
{
    protected $table = 'whatsapp_accounts';

    protected $fillable = [
        'agent_id', 'agency_id', 'waba_id', 'phone_number_id', 'display_phone', 'verified_name',
        'access_token', 'app_secret', 'webhook_key', 'verify_token',
        'quality_rating', 'messaging_limit', 'status', 'last_error', 'last_synced_at',
        'send_from', 'send_until', 'send_saturdays',
    ];

    protected $hidden = ['access_token', 'app_secret', 'verify_token'];

    protected function casts(): array
    {
        return [
            'access_token'   => 'encrypted',
            'app_secret'     => 'encrypted',
            'last_synced_at' => 'datetime',
            'send_saturdays' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $a) {
            $a->webhook_key ??= Str::lower(Str::random(32));
            $a->verify_token ??= Str::random(40);
        });
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'agent_id');
    }

    public function templates(): HasMany
    {
        return $this->hasMany(WaTemplate::class, 'whatsapp_account_id');
    }

    /** People Meta lets this number start conversations with per rolling 24h. */
    public function dailyLimit(): int
    {
        $tier = strtoupper((string) $this->messaging_limit);

        return match (true) {
            str_contains($tier, 'UNLIMITED') => PHP_INT_MAX,
            str_contains($tier, '100K')      => 100_000,
            str_contains($tier, '10K')       => 10_000,
            str_contains($tier, '2K')        => 2_000,
            str_contains($tier, '1K')        => 1_000,
            default                          => 250,
        };
    }
}
