<?php

namespace App\Http\Middleware;

use App\Models\AgencyAgent;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Blocks write requests on /agent routes when the logged-in agent does not
 * have a valid FFC certificate on file. SA's Property Practitioners Act
 * requires a valid FFC before transacting — without one the agent must not
 * be able to create listings, invite tenants, schedule viewings, log
 * inspections, send messages, etc.
 *
 * Read (GET/HEAD) traffic and the FFC upload route itself are always allowed
 * so the agent can fix their compliance status.
 */
class EnsureValidFfc
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        // No user / non-agent users — leave the request alone.
        if (! $user) {
            return $next($request);
        }

        $method = strtoupper($request->method());
        $safeMethods = ['GET', 'HEAD', 'OPTIONS'];

        if (in_array($method, $safeMethods, true)) {
            return $next($request);
        }

        // Allow the FFC upload flow + logout regardless of cert state.
        if ($request->routeIs('agent.ffc.*', 'logout')) {
            return $next($request);
        }

        $pivot = AgencyAgent::where('user_id', $user->id)
            ->where('status', 'active')
            ->first();

        if ($pivot && $pivot->hasValidFfc()) {
            return $next($request);
        }

        // Inertia clients get a redirect to the FFC page with a flash error.
        return redirect()
            ->route('agent.ffc.index')
            ->with('error', $pivot && $pivot->ffc_expires_at
                ? 'Your FFC expired on ' . $pivot->ffc_expires_at->format('d M Y') . '. Upload a current certificate before continuing.'
                : 'Upload your FFC certificate before performing any actions.');
    }
}
