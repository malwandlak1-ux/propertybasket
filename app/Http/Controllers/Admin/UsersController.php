<?php

namespace App\Http\Controllers\Admin;

use App\Enums\Role;
use App\Http\Controllers\Admin\Concerns\EnsuresSuperAdmin;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\User;
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

        $rows = $users->map(function ($u) use ($agencyByOwner, $agencyAgentLink) {
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
}
