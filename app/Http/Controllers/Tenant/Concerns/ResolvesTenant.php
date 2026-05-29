<?php

namespace App\Http\Controllers\Tenant\Concerns;

use App\Models\Lease;
use Illuminate\Http\Request;

trait ResolvesTenant
{
    /**
     * Resolve the active lease for the current tenant user.
     * Prefers an active lease, falls back to the most recent one.
     */
    protected function resolveLease(Request $request): Lease
    {
        $user = $request->user();

        // CASE-based ordering so this works on both MySQL (production) and SQLite (tests).
        $lease = Lease::where('tenant_id', $user->id)
            ->with(['listing', 'agency', 'agent', 'landlord'])
            ->orderByRaw("CASE status
                WHEN 'active'     THEN 1
                WHEN 'pending'    THEN 2
                WHEN 'expired'    THEN 3
                WHEN 'terminated' THEN 4
                ELSE 5 END")
            ->orderByDesc('start_date')
            ->first();

        if (! $lease) {
            abort(403, 'No lease is linked to your account.');
        }

        return $lease;
    }
}
