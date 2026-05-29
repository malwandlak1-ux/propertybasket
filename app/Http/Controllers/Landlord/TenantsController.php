<?php

namespace App\Http\Controllers\Landlord;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Http\Controllers\Landlord\Concerns\ResolvesLandlord;
use App\Models\Invitation;
use App\Models\Landlord;
use App\Models\Lease;
use App\Models\Listing;
use App\Models\User;
use App\Notifications\UserInvited;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class TenantsController extends Controller
{
    use ResolvesLandlord;

    public function index(Request $request): Response
    {
        $landlord = $this->resolveLandlord($request);
        $now      = CarbonImmutable::now();
        $period   = $now->format('Y-m');

        $listingIds = $landlord->listings()->pluck('id');

        $leases = Lease::whereIn('listing_id', $listingIds)
            ->whereIn('status', ['active', 'pending'])
            ->with(['tenant', 'listing', 'rentPayments'])
            ->orderByDesc('start_date')
            ->get();

        $tenants = $leases->map(function ($lease) use ($period, $now) {
            $currentPayment = $lease->rentPayments
                ->where('period_month', $period)
                ->first();

            $payStatus = match (true) {
                $currentPayment === null            => 'no_payment',
                $currentPayment->paid_at !== null   => 'paid',
                $now->gt($currentPayment->due_date) => 'overdue',
                default                             => 'due',
            };

            $daysLeft = $now->diffInDays($lease->end_date, false);

            return [
                'lease_id'        => $lease->id,
                'tenant_id'       => $lease->tenant_id,
                'tenant_name'     => $lease->tenant?->name ?? '—',
                'tenant_email'    => $lease->tenant?->email ?? '—',
                'tenant_initials' => $lease->tenant?->name
                    ? collect(explode(' ', $lease->tenant->name))->map(fn($s) => $s[0])->slice(0, 2)->implode('')
                    : '??',
                'property'        => "{$lease->listing?->suburb}, {$lease->listing?->city}",
                'property_title'  => $lease->listing?->title ?? '—',
                'lease_start'     => $lease->start_date->format('d M Y'),
                'lease_end'       => $lease->end_date->format('d M Y'),
                'monthly_rent'    => (float) $lease->monthly_rent,
                'pay_status'      => $payStatus,
                'portal_status'   => $lease->tenant?->invite_accepted_at ? 'active' : 'pending',
                'days_to_expiry'  => $daysLeft,
                'lease_status'    => $lease->status,
            ];
        })->values()->all();

        return Inertia::render('Landlord/Tenants', [
            'landlord'           => ['id' => $landlord->id, 'name' => $request->user()->name],
            'tenants'            => $tenants,
            'invitable_listings' => self::invitableListings($landlord),
            'pending_invites'    => self::pendingInvites($landlord),
        ]);
    }

    /**
     * POST /landlord/listings/{listing}/invite-tenant
     * Mirrors Agent\ListingsController::inviteTenant: finds or creates the
     * tenant User, creates a Lease, emails the account invitation, and flips
     * the listing to status='leased' so it leaves the public site.
     */
    public function inviteTenant(Request $request, Listing $listing): RedirectResponse
    {
        $landlord = $this->resolveLandlord($request);
        $user     = $request->user();

        abort_unless(
            $listing->owner_type === Landlord::class && $listing->owner_id === $landlord->id,
            403,
            'You can only invite tenants to properties you own.',
        );
        abort_unless(
            $listing->listing_type === 'long_term_rent',
            422,
            'You can only invite tenants to rental listings.',
        );

        $data = $request->validate([
            'tenant_email'   => ['required', 'email', 'max:180'],
            'tenant_name'    => ['required', 'string', 'max:120'],
            'tenant_phone'   => ['nullable', 'string', 'max:30'],
            'start_date'     => ['required', 'date'],
            'end_date'       => ['required', 'date', 'after:start_date'],
            'monthly_rent'   => ['required', 'numeric', 'min:0'],
            'deposit_amount' => ['nullable', 'numeric', 'min:0'],
        ]);

        DB::transaction(function () use ($data, $listing, $landlord, $user) {
            $tenant = User::where('email', $data['tenant_email'])->first();
            if (! $tenant) {
                $tenant = User::create([
                    'name'     => $data['tenant_name'],
                    'email'    => $data['tenant_email'],
                    'phone'    => $data['tenant_phone'] ?? null,
                    'password' => Hash::make(Str::random(40)),
                    'role'     => Role::Tenant,
                    'status'   => UserStatus::Pending,
                ]);
                $tenant->assignRole(Role::Tenant->value);
            }

            $lease = Lease::create([
                'listing_id'     => $listing->id,
                'tenant_id'      => $tenant->id,
                'landlord_id'    => $landlord->user_id,
                'agency_id'      => null,
                'agent_id'       => null,
                'start_date'     => $data['start_date'],
                'end_date'       => $data['end_date'],
                'monthly_rent'   => $data['monthly_rent'],
                'deposit_amount' => $data['deposit_amount'] ?? 0,
                'status'         => 'pending',
            ]);

            if (! $tenant->invite_accepted_at) {
                $invitation = Invitation::create([
                    'email'          => $data['tenant_email'],
                    'role'           => 'tenant',
                    'invited_by'     => $user->id,
                    'invitable_type' => Lease::class,
                    'invitable_id'   => $lease->id,
                    'token'          => (string) Str::uuid(),
                    'expires_at'     => now()->addDays(14),
                ]);
                Notification::route('mail', $data['tenant_email'])->notify(new UserInvited($invitation));
            }

            $listing->update(['status' => 'leased']);
        });

        return redirect()
            ->route('landlord.tenants.index')
            ->with('success', "Tenant invited to \"{$listing->title}\" — the listing is no longer public.");
    }

    public static function invitableListings(Landlord $landlord): array
    {
        return Listing::where('owner_type', Landlord::class)
            ->where('owner_id', $landlord->id)
            ->whereNull('deleted_at')
            ->where('listing_type', 'long_term_rent')
            ->where('status', 'available')
            ->orderByDesc('created_at')
            ->get(['id', 'title', 'suburb', 'monthly_rent'])
            ->map(fn ($l) => [
                'id'           => $l->id,
                'label'        => $l->title . ($l->suburb ? " · {$l->suburb}" : ''),
                'monthly_rent' => $l->monthly_rent !== null ? (float) $l->monthly_rent : null,
            ])
            ->all();
    }

    /**
     * Active/pending leases on this landlord's portfolio where the tenant
     * still hasn't accepted the portal invitation. Surfaced in the Invite
     * Tenant modal so the landlord can (re)send the onboarding email.
     */
    public static function pendingInvites(Landlord $landlord): array
    {
        $listingIds = Listing::where('owner_type', Landlord::class)
            ->where('owner_id', $landlord->id)
            ->whereNull('deleted_at')
            ->pluck('id');

        return Lease::whereIn('listing_id', $listingIds)
            ->whereIn('status', ['active', 'pending'])
            ->with(['tenant:id,name,email,invite_accepted_at', 'listing:id,title,suburb'])
            ->get()
            ->filter(fn ($l) => $l->tenant && ! $l->tenant->invite_accepted_at)
            ->map(fn ($l) => [
                'lease_id'      => $l->id,
                'tenant_name'   => $l->tenant?->name,
                'tenant_email'  => $l->tenant?->email,
                'listing_title' => $l->listing?->title,
                'listing_addr'  => $l->listing?->suburb,
                'lease_status'  => $l->status,
            ])
            ->values()
            ->all();
    }

    /**
     * POST /landlord/leases/{lease}/resend-invite
     * Sends (or re-sends) the portal invitation email to the tenant on this
     * lease. Creates a fresh Invitation token if none is outstanding.
     */
    public function resendInvitation(Request $request, Lease $lease): RedirectResponse
    {
        $landlord = $this->resolveLandlord($request);

        // Authorise — the lease's listing must be owned by this landlord
        $lease->loadMissing(['tenant', 'listing']);
        abort_unless(
            $lease->listing
                && $lease->listing->owner_type === Landlord::class
                && $lease->listing->owner_id === $landlord->id,
            403,
            'You can only invite tenants on leases for your own properties.',
        );
        abort_if(
            $lease->tenant?->invite_accepted_at !== null,
            422,
            'This tenant has already accepted their portal invitation.',
        );

        DB::transaction(function () use ($lease, $request) {
            // Reuse the existing pending invitation if one is on file, else mint a fresh one
            $invitation = Invitation::where('email', $lease->tenant->email)
                ->whereNull('accepted_at')
                ->where('invitable_type', Lease::class)
                ->where('invitable_id', $lease->id)
                ->latest('id')
                ->first();

            if (! $invitation || ($invitation->expires_at && $invitation->expires_at->isPast())) {
                $invitation = Invitation::create([
                    'email'          => $lease->tenant->email,
                    'role'           => 'tenant',
                    'invited_by'     => $request->user()->id,
                    'invitable_type' => Lease::class,
                    'invitable_id'   => $lease->id,
                    'token'          => (string) Str::uuid(),
                    'expires_at'     => now()->addDays(14),
                ]);
            } else {
                // Push expiry out so the tenant gets a fresh 14-day window
                $invitation->update(['expires_at' => now()->addDays(14)]);
            }

            Notification::route('mail', $lease->tenant->email)->notify(new UserInvited($invitation));
        });

        return redirect()
            ->back()
            ->with('success', "Invitation re-sent to {$lease->tenant->name} ({$lease->tenant->email}).");
    }
}
