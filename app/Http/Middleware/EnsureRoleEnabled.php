<?php

namespace App\Http\Middleware;

use App\Support\Edition;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * 404s a route group whose dashboard is switched off for this site
 * (DISABLED_ROLES). Usage: ->middleware(EnsureRoleEnabled::class . ':agent')
 */
class EnsureRoleEnabled
{
    public function handle(Request $request, Closure $next, string $role): Response
    {
        abort_unless(Edition::roleEnabled($role), 404);

        return $next($request);
    }
}
