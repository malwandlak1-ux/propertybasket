<?php

namespace App\Services;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\Invitation;
use App\Models\Lease;
use App\Models\Listing;
use App\Models\User;
use App\Notifications\UserInvited;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

/**
 * Put a tenant into a rental: find or create their account, create the
 * pending lease, invite them to the platform, take the listing off the public
 * site and queue the agent's rental commission. Shared by Invite Tenant on a
 * listing and "Create lease" on a rental application.
 */
class TenantInviter
{
    /**
     * @param  array{tenant_name: string, tenant_email: string, tenant_phone?: ?string, start_date: string, end_date: string, monthly_rent: float|int|string, deposit_amount?: float|int|string|null}  $data
     */
    public function invite(Listing $listing, int $agencyId, ?User $agent, User $invitedBy, array $data): Lease
    {
        [$lease, $invitation] = DB::transaction(function () use ($listing, $agencyId, $agent, $invitedBy, $data) {
            // withTrashed: the email may belong to a user the admin soft-deleted —
            // restore it instead of hitting the unique-email constraint.
            $tenant = User::withTrashed()->where('email', $data['tenant_email'])->first();
            if ($tenant && $tenant->trashed()) {
                $tenant->restore();
                $tenant->update([
                    'name' => $data['tenant_name'],
                    'phone' => $data['tenant_phone'] ?? $tenant->phone,
                    'role' => Role::Tenant,
                    'status' => UserStatus::Pending,
                    'invite_accepted_at' => null,
                ]);
                if (! $tenant->hasRole(Role::Tenant->value)) {
                    $tenant->assignRole(Role::Tenant->value);
                }
            }
            if (! $tenant) {
                $tenant = User::create([
                    'name' => $data['tenant_name'],
                    'email' => $data['tenant_email'],
                    'phone' => $data['tenant_phone'] ?? null,
                    'password' => Hash::make(Str::random(40)),
                    'role' => Role::Tenant,
                    'status' => UserStatus::Pending,
                ]);
                $tenant->assignRole(Role::Tenant->value);
            }

            $landlordId = $listing->owner_type === \App\Models\Landlord::class ? optional($listing->owner)->user_id : null;

            $lease = Lease::create([
                'listing_id' => $listing->id,
                'tenant_id' => $tenant->id,
                'landlord_id' => $landlordId,
                'agency_id' => $agencyId,
                'agent_id' => $agent?->id,
                'start_date' => $data['start_date'],
                'end_date' => $data['end_date'],
                'monthly_rent' => $data['monthly_rent'],
                'deposit_amount' => $data['deposit_amount'] ?? 0,
                'status' => 'pending',
            ]);

            $invitation = null;
            if (! $tenant->invite_accepted_at) {
                $invitation = Invitation::create([
                    'email' => $data['tenant_email'],
                    'role' => 'tenant',
                    'invited_by' => $invitedBy->id,
                    'invitable_type' => Lease::class,
                    'invitable_id' => $lease->id,
                    'token' => (string) Str::uuid(),
                    'expires_at' => now()->addDays(14),
                ]);
            }

            $listing->update(['status' => 'leased']);

            // Renting out an agency listing closes a rental deal: queue the
            // agent's rental commission (idempotent per lease).
            if ($listing->owner_type === Agency::class && $agent) {
                app(CommissionService::class)->recordRental($lease, $agent);
            }

            return [$lease, $invitation];
        });

        // Email outside the transaction: a mail failure must not undo the lease.
        if ($invitation) {
            try {
                Notification::route('mail', $invitation->email)->notify(new UserInvited($invitation));
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return $lease;
    }
}
