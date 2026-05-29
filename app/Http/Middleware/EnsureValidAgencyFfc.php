<?php

namespace App\Http\Middleware;

use App\Models\Agency;
use App\Models\AgencyAgent;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Blocks listing-related write requests when the user's agency does not have a
 * valid FFC certificate. Applied to specific listing routes on both /agent and
 * /agency. The Property Practitioners Act prohibits any practitioner from
 * marketing property without a current FFC at the firm level.
 *
 * Safe methods are always allowed so the user can read pages and learn why
 * they're blocked.
 */
class EnsureValidAgencyFfc
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user) return $next($request);

        $method = strtoupper($request->method());
        if (in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
            return $next($request);
        }

        // Resolve the agency for this user (owner or pivot-linked agent)
        $agency = Agency::where('user_id', $user->id)->first();
        if (! $agency) {
            $pivot = AgencyAgent::where('user_id', $user->id)->where('status', 'active')->first();
            $agency = $pivot?->agency;
        }

        // No agency context — leave the request alone (other middleware will gate)
        if (! $agency) return $next($request);

        if ($agency->hasValidFfc()) {
            return $next($request);
        }

        $redirectRoute = Agency::where('user_id', $user->id)->exists()
            ? 'agency.compliance.show'
            : 'agent.listings.index';

        return redirect()
            ->route($redirectRoute)
            ->with('error', $agency->eaab_ffc_expires_at
                ? "Agency FFC expired on {$agency->eaab_ffc_expires_at->format('d M Y')}. The agency owner must upload a current certificate before any listing can be created."
                : "Your agency must upload a valid Fidelity Fund Certificate before listings can be created. The agency owner can do this under Compliance & FFC.");
    }
}
