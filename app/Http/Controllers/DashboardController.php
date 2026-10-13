<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Support\Edition;
use Illuminate\Support\Facades\Auth;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response|\Illuminate\Http\RedirectResponse
    {
        $user = $request->user();

        // This site has the user's dashboard switched off (DISABLED_ROLES).
        if (! Edition::roleEnabled($user->role)) {
            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return redirect()->route('login')->withErrors([
                'email' => 'This account type is not available on this site.',
            ]);
        }

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
