<?php

namespace App\Support;

use App\Enums\Role;
use App\Models\Agency;
use App\Models\Landlord;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * Helpers that resolve the billable "owner" record behind a user and decide
 * whether that user must hold an active subscription.
 *
 * Only agencies and landlords are gated behind the paywall. Contractors keep
 * the commission / per-job fee model; agents, tenants and admins are never
 * gated here.
 */
class Billing
{
    /** Roles that must carry an active subscription to use their dashboard. */
    public static function requiresSubscription(User $user): bool
    {
        return in_array($user->role, [Role::AgencyAdmin, Role::Landlord], true);
    }

    /** 'agency' | 'landlord' | null — the plan audience for this user. */
    public static function audienceFor(User $user): ?string
    {
        return match ($user->role) {
            Role::AgencyAdmin => 'agency',
            Role::Landlord    => 'landlord',
            default           => null,
        };
    }

    /** The Agency or Landlord record this user owns (the subscription holder). */
    public static function ownerFor(User $user): ?Model
    {
        return match ($user->role) {
            Role::AgencyAdmin => Agency::where('user_id', $user->id)->first(),
            Role::Landlord    => Landlord::where('user_id', $user->id)->first(),
            default           => null,
        };
    }
}
