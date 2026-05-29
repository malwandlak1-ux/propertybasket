<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response|\Illuminate\Http\RedirectResponse
    {
        $user = $request->user();

        return match ($user->role) {
            Role::SuperAdmin  => redirect()->route('admin.overview'),
            Role::AgencyAdmin => redirect()->route('agency.overview'),
            Role::Agent       => redirect()->route('agent.overview'),
            Role::Landlord    => redirect()->route('landlord.overview'),
            Role::Tenant      => redirect()->route('tenant.overview'),
            Role::Contractor  => redirect()->route('contractor.overview'),
            default => Inertia::render('Dashboard/Placeholder', [
                'role' => $user->role?->value,
                'role_label' => $user->role?->label(),
            ]),
        };
    }
}
