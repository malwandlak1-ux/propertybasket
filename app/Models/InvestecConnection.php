<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InvestecConnection extends Model
{
    protected $fillable = [
        'agency_id', 'environment', 'client_id', 'client_secret', 'api_key',
        'account_id', 'account_number', 'account_name', 'connected_at', 'last_checked_at', 'last_error',
    ];

    protected $hidden = ['client_id', 'client_secret', 'api_key'];

    protected function casts(): array
    {
        return [
            'client_id'       => 'encrypted',
            'client_secret'   => 'encrypted',
            'api_key'         => 'encrypted',
            'connected_at'    => 'datetime',
            'last_checked_at' => 'datetime',
        ];
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function baseUrl(): string
    {
        return $this->environment === 'sandbox' ? 'https://openapisandbox.investec.com' : 'https://openapi.investec.com';
    }
}
