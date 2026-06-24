<?php

namespace App\Http\Controllers\Admin;

use App\Enums\UserStatus;
use App\Http\Controllers\Admin\Concerns\EnsuresSuperAdmin;
use App\Models\Landlord;
use App\Models\Lease;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Inertia\Inertia;
use Inertia\Response;

class LandlordsController extends Controller
{
    use EnsuresSuperAdmin;

    public function index(Request $request): Response
    {
        $this->ensureSuperAdmin($request);

        $landlords = Landlord::with(['user', 'listings'])
            ->orderBy('id')
            ->get()
            ->map(function ($l) {
                $listingIds   = $l->listings->pluck('id');
                $activeLeases = Lease::whereIn('listing_id', $listingIds)
                    ->where('status', 'active')
                    ->count();

                $name = $l->user?->name ?? '—';

                return [
                    'id'             => $l->id,
                    'user_id'        => $l->user_id,
                    'name'           => $name,
                    'email'          => $l->user?->email ?? '—',
                    'phone'          => $l->user?->phone,
                    'property_count' => $l->property_count ?? $l->listings->count(),
                    'active_leases'  => $activeLeases,
                    'fica_verified'  => $l->fica_verified_at !== null,
                    'subscription'   => $l->subscription_plan ?? 'private',
                    'at_cap'         => $l->listings->count() >= 5,
                    'joined'         => $l->created_at?->format('M Y'),
                    'status'         => $l->user?->status?->value ?? 'active',
                    'initials'       => collect(explode(' ', $name))->map(fn($s) => $s[0])->slice(0, 2)->implode(''),
                ];
            });

        $stats = [
            'total'        => $landlords->count(),
            'verified'     => $landlords->where('fica_verified', true)->count(),
            'at_cap'       => $landlords->where('at_cap', true)->count(),
            'properties'   => $landlords->sum('property_count'),
        ];

        return Inertia::render('Admin/Landlords', [
            'counts'    => $this->sidebarCounts(),
            'landlords' => $landlords->values(),
            'stats'     => $stats,
        ]);
    }

    public function verifyFica(Request $request, Landlord $landlord): RedirectResponse
    {
        $this->ensureSuperAdmin($request);

        $name = $landlord->user?->name ?? "Landlord #{$landlord->id}";

        if ($landlord->fica_verified_at !== null) {
            $landlord->update(['fica_verified_at' => null]);

            return back()->with('success', "{$name}: FICA verification revoked.");
        }

        $landlord->update(['fica_verified_at' => now()]);

        return back()->with('success', "{$name}: FICA verified.");
    }

    public function activate(Request $request, Landlord $landlord): RedirectResponse
    {
        $this->ensureSuperAdmin($request);

        $user = $landlord->user;
        if (! $user) {
            return back()->with('error', 'Landlord has no linked user account.');
        }

        if ($user->status === UserStatus::Active) {
            return back()->with('error', "{$user->name} is already active.");
        }

        $user->update(['status' => UserStatus::Active]);

        return back()->with('success', "{$user->name} activated.");
    }

    public function suspend(Request $request, Landlord $landlord): RedirectResponse
    {
        $this->ensureSuperAdmin($request);

        $user = $landlord->user;
        if (! $user) {
            return back()->with('error', 'Landlord has no linked user account.');
        }

        if ($user->status === UserStatus::Suspended) {
            return back()->with('error', "{$user->name} is already suspended.");
        }

        $user->update(['status' => UserStatus::Suspended]);

        return back()->with('success', "{$user->name} suspended.");
    }
}
