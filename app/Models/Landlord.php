<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Landlord extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'user_id', 'id_number', 'fica_verified_at',
        'paystack_customer_code', 'paystack_recipient_code', 'property_count',
        'bank_name', 'bank_account_holder', 'bank_account_number',
        'bank_branch_code', 'bank_account_type', 'bank_verified_at',
        'subscription_plan', 'subscription_expires_at',
    ];

    protected function casts(): array
    {
        return [
            'fica_verified_at' => 'datetime',
            'bank_verified_at' => 'datetime',
            'subscription_expires_at' => 'datetime',
        ];
    }

    /**
     * True when the four required banking fields are on file — used to gate
     * payouts and surface the banking-incomplete banner on the dashboard.
     */
    public function hasBankingDetails(): bool
    {
        return ! empty($this->bank_name)
            && ! empty($this->bank_account_holder)
            && ! empty($this->bank_account_number)
            && ! empty($this->bank_branch_code);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function listings(): MorphMany
    {
        return $this->morphMany(Listing::class, 'owner');
    }
}
