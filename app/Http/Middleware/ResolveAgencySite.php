<?php

namespace App\Http\Middleware;

use App\Models\AgencyWebsite;
use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

/**
 * Resolves the agency website for the request host (routes/sites.php).
 *
 *   {subdomain}.{SITES_BASE_DOMAIN}  → agency_websites.subdomain
 *   any other host                    → agency_websites.custom_domain (once live)
 *
 * Unknown hosts, unpublished sites and suspended agencies 404. An unpublished
 * site can be previewed with ?preview={token} (the dashboard "Preview" link);
 * the token is remembered in the session for that host.
 */
class ResolveAgencySite
{
    public function handle(Request $request, Closure $next): Response
    {
        $host = strtolower($request->getHost());
        $request->route()?->forgetParameter('site_host');

        $site = self::findForHost($host);
        abort_unless($site && $site->agency && $site->agency->status === 'active', 404);

        if (! $site->isPublished() && ! $this->canPreview($request, $site)) {
            abort(404);
        }

        app()->instance(AgencyWebsite::class, $site);

        Inertia::share('site', fn () => self::sharedProps($site));

        return $next($request);
    }

    public static function findForHost(string $host): ?AgencyWebsite
    {
        $suffix = '.'.strtolower(config('sites.base_domain'));

        $query = AgencyWebsite::with('agency');
        if (str_ends_with($host, $suffix)) {
            $sub = substr($host, 0, -strlen($suffix));
            // Let "www.sandton-realty.<base>" behave like the bare subdomain.
            $sub = preg_replace('/^www\./', '', $sub);

            return $query->where('subdomain', $sub)->first();
        }

        $bare = preg_replace('/^www\./', '', $host);

        return $query
            ->whereIn('custom_domain', [$bare, 'www.'.$bare])
            ->where('domain_status', 'live')
            ->first();
    }

    public static function previewToken(AgencyWebsite $site): string
    {
        return substr(hash_hmac('sha256', 'site-preview:'.$site->id, (string) config('app.key')), 0, 24);
    }

    private function canPreview(Request $request, AgencyWebsite $site): bool
    {
        $token = self::previewToken($site);
        $key = 'site_preview_'.$site->id;

        if (hash_equals($token, (string) $request->query('preview', ''))) {
            $request->session()->put($key, true);

            return true;
        }

        return (bool) $request->session()->get($key, false);
    }

    public static function sharedProps(AgencyWebsite $site): array
    {
        $agency = $site->agency;
        $links = array_filter((array) $site->social_links);

        return [
            'name'            => $agency->name,
            'template'        => $site->template,
            'published'       => $site->isPublished(),
            'logo'            => AgencyWebsite::publicUrl($agency->logo),
            'primary_color'   => $site->primary_color ?: '#F26A1B',
            'accent_color'    => $site->accent_color ?: '#1F2937',
            'tagline'         => $site->tagline,
            'show_agents'     => $site->show_agents,
            'contact'         => [
                'email'   => $agency->email,
                'phone'   => $agency->phone,
                'address' => $agency->head_office_address,
            ],
            'social_links'    => $links,
            'analytics_id'    => $site->analytics_id,
            'portal_url'      => rtrim((string) config('app.url'), '/'),
        ];
    }
}
