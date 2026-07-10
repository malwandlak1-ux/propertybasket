<?php

namespace App\Http\Controllers\Admin;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Http\Controllers\Admin\Concerns\EnsuresSuperAdmin;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Inertia\Inertia;
use Inertia\Response;

class UsersController extends Controller
{
    use EnsuresSuperAdmin;

    public function index(Request $request): Response
    {
        $this->ensureSuperAdmin($request);

        $filter = $request->string('role')->toString();
        $search = $request->string('q')->toString();

        $query = User::query()->orderByDesc('id');

        if ($filter && in_array($filter, ['agency_admin', 'agent', 'landlord', 'tenant', 'contractor', 'super_admin'], true)) {
            $query->where('role', $filter);
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $users = $query->limit(100)->get();

        // Build agency map (agency_admin's agency + agent's agency)
        $agencyByOwner = Agency::pluck('name', 'user_id')->toArray();
        $agencyAgentLink = AgencyAgent::with('agency')->get()
            ->keyBy('user_id')
            ->map(fn($p) => $p->agency?->name ?? null)
            ->toArray();

        $currentUserId = $request->user()?->id;

        $rows = $users->map(function ($u) use ($agencyByOwner, $agencyAgentLink, $currentUserId) {
            $belongs = $agencyByOwner[$u->id] ?? $agencyAgentLink[$u->id] ?? null;
            if (! $belongs && in_array($u->role?->value, ['landlord', 'contractor', 'tenant'], true)) {
                $belongs = 'Independent';
            }

            return [
                'id'         => $u->id,
                'name'       => $u->name,
                'email'      => $u->email,
                'role'       => $u->role?->value ?? 'unknown',
                'role_label' => $u->role?->label() ?? '—',
                'belongs_to' => $belongs ?? '—',
                'last_active'=> $u->updated_at?->diffForHumans(),
                'status'     => $u->status?->value ?? 'active',
                'initials'   => collect(explode(' ', $u->name))->map(fn($s) => $s[0])->slice(0, 2)->implode(''),
                'joined'     => $u->created_at?->format('d M Y'),
                'is_self'    => $u->id === $currentUserId,
                'is_super_admin' => $u->role?->value === 'super_admin',
            ];
        });

        $counts = [
            'all'          => User::count(),
            'agency_admin' => User::where('role', Role::AgencyAdmin)->count(),
            'agent'        => User::where('role', Role::Agent)->count(),
            'landlord'     => User::where('role', Role::Landlord)->count(),
            'tenant'       => User::where('role', Role::Tenant)->count(),
            'contractor'   => User::where('role', Role::Contractor)->count(),
        ];

        return Inertia::render('Admin/Users', [
            'counts'      => $this->sidebarCounts(),
            'users'       => $rows->values(),
            'role_counts' => $counts,
            'filter'      => $filter ?: 'all',
            'search'      => $search,
        ]);
    }

    public function activate(Request $request, User $user): RedirectResponse
    {
        $this->ensureSuperAdmin($request);

        if ($user->status === UserStatus::Active) {
            return back()->with('error', "{$user->name} is already active.");
        }

        $user->update(['status' => UserStatus::Active]);

        return back()->with('success', "{$user->name} activated.");
    }

    public function suspend(Request $request, User $user): RedirectResponse
    {
        $this->ensureSuperAdmin($request);

        if ($user->id === $request->user()?->id) {
            return back()->with('error', "You can't suspend your own account.");
        }

        if ($user->role?->value === 'super_admin') {
            return back()->with('error', "Super admins can't be suspended from this panel.");
        }

        if ($user->status === UserStatus::Suspended) {
            return back()->with('error', "{$user->name} is already suspended.");
        }

        $user->update(['status' => UserStatus::Suspended]);

        return back()->with('success', "{$user->name} suspended.");
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        $this->ensureSuperAdmin($request);

        if ($user->id === $request->user()?->id) {
            return back()->with('error', "You can't delete your own account.");
        }

        if ($user->role?->value === 'super_admin') {
            return back()->with('error', "Super admins can't be deleted from this panel.");
        }

        $name = $user->name;

        // Remove the agency_agents pivot so a future re-invite starts clean.
        AgencyAgent::where('user_id', $user->id)->delete();

        // Expire any pending invitations for this email.
        \App\Models\Invitation::where('email', $user->email)
            ->whereNull('accepted_at')
            ->update(['expires_at' => now()]);

        // Release the unique fields (email + invite_token) so this person can
        // register again later. `users.email` is uniquely indexed, so without
        // this the soft-deleted row keeps the address reserved and re-signup
        // fails with "email already taken" even though the user is gone.
        $user->email = User::releasedEmail($user->id, $user->email);
        $user->invite_token = null;
        $user->save();

        $user->delete(); // soft delete — row preserved with deleted_at timestamp

        return back()->with('success', "{$name} deleted.");
    }
}
