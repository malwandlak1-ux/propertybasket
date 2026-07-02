<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Stop browsers from caching app HTML/Inertia responses.
 *
 * Without this, a stale cached document — e.g. the old WordPress homepage that
 * used to live at "/" before this app took over the domain — can be replayed by
 * the browser on an Inertia navigation (logout redirect, logo click), showing
 * the wrong page inside Inertia's error dialog.
 *
 * Hashed JS/CSS assets in public/build are served by the web server directly
 * (not through Laravel), so they keep their long-lived cache; this only affects
 * responses that pass through the framework.
 */
class PreventPageCaching
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        $response->headers->set('Pragma', 'no-cache');

        return $response;
    }
}
