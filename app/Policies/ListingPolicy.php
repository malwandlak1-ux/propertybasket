<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\Listing;
use App\Models\User;

class ListingPolicy
{
    public function viewAny(?User $user): bool
    {
        return true;
    }

    public function view(?User $user, Listing $listing): bool
    {
        return $listing->status === 'available' && $listing->deleted_at === null;
    }

    public function create(User $user): bool
    {
        return in_array($user->role, [
            Role::AgencyAdmin, Role::Agent, Role::Landlord,
        ], true);
    }

    public function createSale(User $user): bool
    {
        // Landlords are explicitly blocked from sale listings per Section 2.5.
        return in_array($user->role, [Role::AgencyAdmin, Role::Agent], true);
    }

    public function update(User $user, Listing $listing): bool
    {
        return $this->isOwner($user, $listing);
    }

    public function softDelete(User $user, Listing $listing): bool
    {
        return $this->isOwner($user, $listing);
    }

    public function restore(User $user, Listing $listing): bool
    {
        return $this->isOwner($user, $listing);
    }

    private function isOwner(User $user, Listing $listing): bool
    {
        if ($user->role === Role::SuperAdmin) {
            return true;
        }

        return match ($listing->owner_type) {
            \App\Models\Agency::class => $listing->owner?->user_id === $user->id
                || $listing->agent_id === $user->id,
            \App\Models\Landlord::class => $listing->owner?->user_id === $user->id,
            default => false,
        };
    }
}
