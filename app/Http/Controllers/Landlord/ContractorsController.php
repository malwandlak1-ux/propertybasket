<?php

namespace App\Http\Controllers\Landlord;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Http\Controllers\Landlord\Concerns\ResolvesLandlord;
use App\Models\Contractor;
use App\Models\Invitation;
use App\Models\MaintenanceRequest;
use App\Models\User;
use App\Notifications\UserInvited;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class ContractorsController extends Controller
{
    use ResolvesLandlord;

    /** GET /landlord/contractors — the landlord's own contractor roster. */
    public function index(Request $request): Response
    {
        $landlord   = $this->resolveLandlord($request);
        $listingIds = $landlord->listings()->pluck('id');

        $contractors = $landlord->contractors()
            ->with('user:id,name,email,phone,status')
            ->orderBy('business_name')
            ->get()
            ->map(function (Contractor $c) use ($listingIds) {
                $jobs = MaintenanceRequest::whereIn('property_id', $listingIds)->where('assigned_to', $c->user_id);

                return [
                    'id'             => $c->id,
                    'business_name'  => $c->business_name,
                    'contact_name'   => $c->user?->name,
                    'email'          => $c->user?->email,
                    'phone'          => $c->user?->phone,
                    'specialities'   => is_array($c->specialities) ? $c->specialities : [],
                    'average_rating' => (float) $c->average_rating,
                    'total_reviews'  => (int) $c->total_reviews,
                    'active_jobs'    => (clone $jobs)->whereIn('status', ['open', 'in_progress'])->count(),
                    'done_jobs'      => (clone $jobs)->whereIn('status', ['completed', 'paid'])->count(),
                    'has_banking'    => (bool) $c->hasBankingDetails(),
                    'account_state'  => $c->user?->status?->value === 'active' ? 'active' : 'invited',
                ];
            })
            ->values();

        return Inertia::render('Landlord/Contractors', [
            'landlord'    => ['id' => $landlord->id, 'name' => $request->user()->name],
            'contractors' => $contractors,
        ]);
    }

    /**
     * POST /landlord/contractors — invite a contractor by email. An existing
     * contractor account is simply added to the roster; a new one gets an
     * account invitation.
     */
    public function store(Request $request): RedirectResponse
    {
        $landlord = $this->resolveLandlord($request);

        $data = $request->validate([
            'business_name'  => ['required', 'string', 'max:160'],
            'contact_name'   => ['required', 'string', 'max:120'],
            'email'          => ['required', 'email', 'max:180'],
            'phone'          => ['nullable', 'string', 'max:30'],
            'specialities'   => ['nullable', 'array'],
            'specialities.*' => ['string', 'max:60'],
        ]);

        $existing = User::withTrashed()->where('email', $data['email'])->first();
        if ($existing && ! $existing->trashed() && $existing->role !== Role::Contractor) {
            return back()->withErrors(['email' => 'This email belongs to a non-contractor account. Use a different email.']);
        }

        [$contractor, $invitation] = DB::transaction(function () use ($data, $landlord, $request, $existing) {
            $user = $existing;
            if ($user && $user->trashed()) {
                $user->restore();
                $user->update([
                    'name' => $data['contact_name'], 'phone' => $data['phone'] ?? $user->phone,
                    'role' => Role::Contractor, 'status' => UserStatus::Pending, 'invite_accepted_at' => null,
                ]);
            }
            if (! $user) {
                $user = User::create([
                    'name'     => $data['contact_name'],
                    'email'    => $data['email'],
                    'phone'    => $data['phone'] ?? null,
                    'password' => Hash::make(Str::random(40)),
                    'role'     => Role::Contractor,
                    'status'   => UserStatus::Pending,
                ]);
            }
            if (! $user->hasRole(Role::Contractor->value)) {
                $user->assignRole(Role::Contractor->value);
            }

            // One contractor profile per person: reuse it if they already have one.
            $contractor = Contractor::where('user_id', $user->id)->oldest('id')->first()
                ?? Contractor::create([
                    'user_id'                => $user->id,
                    'created_by_landlord_id' => $landlord->id,
                    'business_name'          => $data['business_name'],
                    'specialities'           => $data['specialities'] ?? [],
                    'service_areas'          => [],
                    'status'                 => 'active',
                ]);

            $landlord->contractors()->syncWithoutDetaching([$contractor->id]);

            $invitation = null;
            if (! $user->invite_accepted_at && $user->status !== UserStatus::Active) {
                Invitation::where('email', $user->email)->whereNull('accepted_at')->delete();
                $invitation = Invitation::create([
                    'email'          => $user->email,
                    'role'           => 'contractor',
                    'invited_by'     => $request->user()->id,
                    'invitable_type' => Contractor::class,
                    'invitable_id'   => $contractor->id,
                    'token'          => (string) Str::uuid(),
                    'expires_at'     => now()->addDays(14),
                ]);
            }

            return [$contractor, $invitation];
        });

        if ($invitation) {
            try {
                Notification::route('mail', $invitation->email)->notify(new UserInvited($invitation));
            } catch (\Throwable $e) {
                report($e);
            }
        }

        $name = $contractor->business_name ?? $data['business_name'];

        return back()->with('success', $invitation
            ? "{$name} added. An invitation to set up their account was emailed to {$data['email']}."
            : "{$name} already has an account and is now on your contractor list.");
    }

    /** DELETE /landlord/contractors/{contractor} — remove from the roster (their account stays). */
    public function destroy(Request $request, Contractor $contractor): RedirectResponse
    {
        $landlord = $this->resolveLandlord($request);
        abort_unless($landlord->contractors()->whereKey($contractor->id)->exists(), 404);

        $busy = MaintenanceRequest::whereIn('property_id', $landlord->listings()->pluck('id'))
            ->where('assigned_to', $contractor->user_id)
            ->whereIn('status', ['open', 'in_progress', 'completed'])
            ->exists();
        if ($busy) {
            return back()->with('error', 'This contractor still has an open job on your properties. Finish or re-assign it first.');
        }

        $landlord->contractors()->detach($contractor->id);

        return back()->with('success', ($contractor->business_name ?? 'Contractor') . ' removed from your list.');
    }
}
