<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A landlord who has appointed the agency to manage their rental property.
 * No login — the agency captures and maintains these details. Distinct from
 * the self-service {@see Landlord} model (which belongs to a User account).
 */
class ManagedLandlord extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'agency_id', 'name', 'email', 'phone',
        'bank_name', 'bank_account_holder', 'bank_account_number',
        'bank_branch_code', 'bank_account_type', 'paystack_recipient_code',
    ];

    public function hasBankingDetails(): bool
    {
        return ! empty($this->bank_name)
            && ! empty($this->bank_account_holder)
            && ! empty($this->bank_account_number)
            && ! empty($this->bank_branch_code);
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function listings(): HasMany
    {
        return $this->hasMany(Listing::class, 'managed_landlord_id');
    }

    public function payouts(): HasMany
    {
        return $this->hasMany(LandlordPayout::class);
    }
}
