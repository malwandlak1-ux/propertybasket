<?php

namespace App\Http\Middleware;

use App\Enums\UserStatus;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Rejects API requests whose (Sanctum-authenticated) user is no longer active.
 *
 * Sanctum's `auth:sanctum` guard validates the token but not account status,
 * so without this a suspended agent/tenant would keep working until their
 * token happened to be deleted. Chained after `auth:sanctum` on /api/v1.
 */
class EnsureApiUserActive
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()?->status !== UserStatus::Active) {
            return response()->json(['message' => 'Your account is not active.'], 403);
        }

        return $next($request);
    }
}
