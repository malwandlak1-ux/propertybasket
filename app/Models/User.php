<?php

namespace App\Models;

use App\Enums\Role;
use App\Enums\UserStatus;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, HasRoles, Notifiable, SoftDeletes;

    protected $fillable = [
        'name',
        'email',
        'email_verified_at',
        'password',
        'phone',
        'avatar',
        'role',
        'status',
        'paystack_recipient_code',
        'paystack_customer_code',
        'bank_account_holder',
        'bank_account_number',
        'bank_code',
        'notification_preferences',
        'invited_by',
        'invite_token',
        'invite_accepted_at',
        'last_active_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'invite_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'invite_accepted_at' => 'datetime',
            'last_active_at' => 'datetime',
            'password' => 'hashed',
            'role' => Role::class,
            'status' => UserStatus::class,
            'notification_preferences' => 'array',
        ];
    }

    public function agency(): HasOne
    {
        return $this->hasOne(Agency::class);
    }

    public function landlord(): HasOne
    {
        return $this->hasOne(Landlord::class);
    }

    public function contractor(): HasOne
    {
        return $this->hasOne(Contractor::class);
    }

    public function agencies(): BelongsToMany
    {
        return $this->belongsToMany(Agency::class, 'agency_agents')
            ->withPivot([
                'commission_split_percent', 'area_speciality', 'property_type_speciality',
                'ffc_number', 'ffc_expires_at', 'lead_allocation_position', 'status',
            ])
            ->withTimestamps();
    }

    public function invitedBy(): BelongsTo
    {
        return $this->belongsTo(self::class, 'invited_by');
    }

    public function invitationsSent(): HasMany
    {
        return $this->hasMany(Invitation::class, 'invited_by');
    }

    public function listingsAsAgent(): HasMany
    {
        return $this->hasMany(Listing::class, 'agent_id');
    }

    public function inquiriesAssigned(): HasMany
    {
        return $this->hasMany(Inquiry::class, 'assigned_to');
    }

    public function leasesAsTenant(): HasMany
    {
        return $this->hasMany(Lease::class, 'tenant_id');
    }

    public function isRole(Role $role): bool
    {
        return $this->role === $role;
    }

    /** Prefix marking a soft-deleted user's released (freed-up) email. */
    public const DELETED_EMAIL_PREFIX = '__deleted';

    /**
     * The "released" email value for a deleted user. `users.email` is uniquely
     * indexed, so a soft-deleted row keeps its address reserved — mangling it
     * frees the real address for re-registration while preserving the tombstone
     * row (and its FK references) for audit. Idempotent.
     */
    public static function releasedEmail(int $id, string $email): string
    {
        if (str_starts_with($email, self::DELETED_EMAIL_PREFIX)) {
            return $email; // already released
        }

        return self::DELETED_EMAIL_PREFIX.$id.'__'.$email;
    }

    /**
     * True when the user has a usable payout method — either a Paystack
     * recipient code or full local banking details captured on their profile.
     * Agents can be paid on banking details alone, without Paystack.
     */
    public function hasPayoutDetails(): bool
    {
        return ! empty($this->paystack_recipient_code)
            || (! empty($this->bank_account_holder)
                && ! empty($this->bank_account_number)
                && ! empty($this->bank_code));
    }
}
