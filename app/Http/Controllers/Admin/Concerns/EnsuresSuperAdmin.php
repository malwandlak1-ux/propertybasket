<?php

namespace App\Http\Controllers\Admin\Concerns;

use App\Enums\Role;
use Illuminate\Http\Request;

trait EnsuresSuperAdmin
{
    /**
     * Abort with 403 if the current user is not a super admin.
     */
    protected function ensureSuperAdmin(Request $request): void
    {
        $user = $request->user();
        if (! $user || $user->role !== Role::SuperAdmin) {
            abort(403, 'Super admin access required.');
        }
    }

    /**
     * Counts used by the AdminLayout sidebar badges.
     * Every admin controller should pass these via `counts` in its Inertia props.
     */
    protected function sidebarCounts(): array
    {
        return [
            'agencies'    => \App\Models\Agency::count(),
            'landlords'   => \App\Models\Landlord::count(),
            'contractors' => \App\Models\Contractor::count(),
        ];
    }
}
