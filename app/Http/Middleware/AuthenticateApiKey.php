<?php

namespace App\Http\Middleware;

use App\Models\ApiKey;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Integration API: authenticates "Authorization: Bearer pbk_…" (or an
 * X-Api-Key header) against the landlord's API keys. Always answers in
 * JSON. The key and its landlord are available as request attributes.
 */
class AuthenticateApiKey
{
    public function handle(Request $request, Closure $next, string $scope = ApiKey::SCOPE_STATEMENTS): Response
    {
        $request->headers->set('Accept', 'application/json');

        $plain = $request->bearerToken() ?: (string) $request->header('X-Api-Key', '');
        $key = $plain !== '' ? ApiKey::findActive($plain) : null;

        if (! $key) {
            return response()->json(['error' => 'unauthenticated', 'message' => 'Missing, invalid or revoked API key.'], 401);
        }
        if (! $key->can($scope)) {
            return response()->json(['error' => 'forbidden', 'message' => "This key does not have the {$scope} scope."], 403);
        }

        $landlord = $key->landlord()->with('user')->first();
        if (! $landlord || ! $landlord->user || $landlord->user->status?->value !== 'active') {
            return response()->json(['error' => 'forbidden', 'message' => 'The account this key belongs to is not active.'], 403);
        }

        // Record use at most once a minute (cheap, and enough for an audit trail).
        if (! $key->last_used_at || $key->last_used_at->lt(now()->subMinute())) {
            $key->forceFill(['last_used_at' => now(), 'last_used_ip' => $request->ip()])->saveQuietly();
        }

        $request->attributes->set('api_key', $key);
        $request->attributes->set('landlord', $landlord);

        return $next($request);
    }
}
