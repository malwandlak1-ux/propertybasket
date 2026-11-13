<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Agency websites (dashboard Website tab, admin Agency Websites) are switched
 * off per site with SITES_ENABLED=false — e.g. on production until release.
 * routes/sites.php already skips serving the sites themselves in that case.
 */
class EnsureAgencySitesEnabled
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless(config('sites.enabled'), 404);

        return $next($request);
    }
}
