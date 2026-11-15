<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\EnsuresSuperAdmin;
use App\Models\AgencyWebsite;
use App\Models\Inquiry;
use App\Models\Listing;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Inertia\Inertia;
use Inertia\Response;

/**
 * /admin/websites — every agency website, plus the custom-domain queue.
 *
 * On shared hosting (Hostinger) a custom domain can't be switched on
 * automatically: once an agency's DNS verifies, a super admin adds the
 * domain in hPanel (parked on the prod folder, SSL issued) and then clicks
 * "Mark live" here, which is when the site starts answering on that domain.
 */
class WebsitesController extends Controller
{
    use EnsuresSuperAdmin;

    public function index(Request $request): Response
    {
        $this->ensureSuperAdmin($request);

        $leads = Inquiry::whereNotNull('agency_website_id')
            ->where('created_at', '>=', now()->subDays(30))
            ->selectRaw('agency_website_id, COUNT(*) as total')
            ->groupBy('agency_website_id')
            ->pluck('total', 'agency_website_id');

        $sites = AgencyWebsite::with('agency:id,name,status')
            ->orderByRaw("CASE domain_status WHEN 'verified' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END")
            ->orderBy('subdomain')
            ->get()
            ->map(fn (AgencyWebsite $s) => [
                'id'             => $s->id,
                'agency'         => $s->agency?->name,
                'agency_status'  => $s->agency?->status,
                'subdomain_host' => $s->subdomainHost(),
                'custom_domain'  => $s->custom_domain,
                'domain_status'  => $s->domain_status,
                'verified_at'    => $s->domain_verified_at?->format('d M Y H:i'),
                'status'         => $s->status,
                'template'       => $s->template,
                'url'            => $s->url(),
                'listings'       => Listing::publiclyVisible()->forAgency($s->agency_id)->count(),
                'leads_30d'      => (int) ($leads[$s->id] ?? 0),
            ]);

        return Inertia::render('Admin/Websites', [
            'sites' => $sites,
            'stats' => [
                'total'     => $sites->count(),
                'published' => $sites->where('status', 'published')->count(),
                'queue'     => $sites->where('domain_status', 'verified')->count(),
                'live_domains' => $sites->where('domain_status', 'live')->count(),
            ],
            'docroot_hint' => 'public_html/prod',
        ]);
    }

    public function markLive(Request $request, AgencyWebsite $website): RedirectResponse
    {
        $this->ensureSuperAdmin($request);
        abort_unless($website->custom_domain && in_array($website->domain_status, ['verified', 'pending'], true), 422, 'No domain waiting to go live.');

        $website->update(['domain_status' => 'live', 'domain_verified_at' => $website->domain_verified_at ?? now()]);

        return back()->with('success', "{$website->custom_domain} is now live.");
    }

    public function disconnect(Request $request, AgencyWebsite $website): RedirectResponse
    {
        $this->ensureSuperAdmin($request);

        $website->update(['domain_status' => $website->custom_domain ? 'pending' : 'none']);

        return back()->with('success', 'Domain taken offline — the site still answers on its free address.');
    }
}
