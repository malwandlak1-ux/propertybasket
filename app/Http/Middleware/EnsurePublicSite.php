<?php

namespace App\Http\Middleware;

use App\Support\Edition;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Sites without the public property portal (PUBLIC_SITE=false, e.g. careline)
 * send portal pages to the login screen — or straight to the dashboard when
 * already signed in. Portal form POSTs (inquiries, tours, demos) are refused.
 */
class EnsurePublicSite
{
    public function handle(Request $request, Closure $next): Response
    {
        if (Edition::publicSiteEnabled()) {
            return $next($request);
        }

        abort_unless($request->isMethod('GET') || $request->isMethod('HEAD'), 404);

        return redirect()->route($request->user() ? 'dashboard' : 'login');
    }
}
