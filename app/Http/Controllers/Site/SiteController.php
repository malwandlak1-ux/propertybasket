<?php

namespace App\Http\Controllers\Site;

use App\Http\Controllers\Controller;
use App\Models\AgencyAgent;
use App\Models\AgencyWebsite;
use App\Models\Listing;
use App\Services\InquiryService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The generated agency website (routes/sites.php). Every listing query goes
 * through Listing::publiclyVisible() — the same rule as the main portal — so
 * a listing marked sold / rented in the dashboard drops off both at once.
 */
class SiteController extends Controller
{
    private const CARD_COLUMNS = [
        'id', 'slug', 'title', 'listing_type', 'property_type', 'agent_id',
        'suburb', 'city', 'bedrooms', 'bathrooms', 'area_sqm',
        'primary_image', 'sale_price', 'monthly_rent', 'short_stay_nightly_price',
    ];

    private ?AgencyWebsite $resolved = null;

    /**
     * The site bound by ResolveAgencySite. Resolved lazily — Laravel builds
     * controllers before route middleware runs, so constructor injection
     * would receive an empty model.
     */
    public function __get(string $name)
    {
        if ($name === 'site') {
            return $this->resolved ??= app(AgencyWebsite::class);
        }

        return null;
    }

    private function listings(): Builder
    {
        return Listing::query()->publiclyVisible()->forAgency($this->site->agency_id);
    }

    private function render(string $page, array $props, array $seo = []): Response
    {
        $agency = $this->site->agency;

        return Inertia::render($page, $props)->withViewData(['siteMeta' => [
            'title'       => $seo['title'] ?? ($this->site->seo_title ?: $agency->name),
            'description' => $seo['description'] ?? ($this->site->seo_description ?: $this->site->tagline ?: "Properties for sale and to rent with {$agency->name}."),
            'image'       => $seo['image'] ?? AgencyWebsite::publicUrl($this->site->hero_image),
            'icon'        => AgencyWebsite::publicUrl($agency->logo),
            'url'         => request()->url(),
            'site_name'   => $agency->name,
            'color'       => $this->site->primary_color ?: '#F26A1B',
            'analytics'   => $this->site->analytics_id,
        ]]);
    }

    /** Agents shown on the site, with a stable public slug. */
    private function agents()
    {
        return AgencyAgent::with('user:id,name,email,phone,avatar')
            ->where('agency_id', $this->site->agency_id)
            ->where('status', 'active')
            ->where('show_on_website', true)
            ->orderBy('id')
            ->get()
            ->filter(fn ($a) => $a->user)
            ->map(fn ($a) => $this->ensureSlug($a));
    }

    private function ensureSlug(AgencyAgent $a): AgencyAgent
    {
        if (! $a->public_slug) {
            $base = Str::slug($a->user->name) ?: 'agent';
            $slug = $base;
            $i = 2;
            while (AgencyAgent::where('agency_id', $a->agency_id)->where('public_slug', $slug)->where('id', '!=', $a->id)->exists()) {
                $slug = $base.'-'.$i++;
            }
            $a->forceFill(['public_slug' => $slug])->save();
        }

        return $a;
    }

    private function agentCard(AgencyAgent $a, ?int $count = null): array
    {
        return [
            'id'       => $a->user_id,
            'slug'     => $a->public_slug,
            'name'     => $a->user->name,
            'email'    => $a->user->email,
            'phone'    => $a->user->phone,
            'avatar'   => AgencyWebsite::publicUrl($a->user->avatar),
            'bio'      => $a->bio,
            'areas'    => array_values((array) $a->area_speciality),
            'listings' => $count,
        ];
    }

    public function home(): Response
    {
        $counts = $this->listings()->selectRaw('listing_type, COUNT(*) as total')->groupBy('listing_type')->pluck('total', 'listing_type');
        $agents = $this->site->show_agents ? $this->agents()->take(8)->map(fn ($a) => $this->agentCard($a))->values() : [];

        return $this->render('Site/Home', [
            'hero' => [
                'heading' => $this->site->hero_heading ?: 'Find your next home with '.$this->site->agency->name,
                'image'   => AgencyWebsite::publicUrl($this->site->hero_image),
            ],
            'featured' => [
                'for_sale'       => $this->listings()->where('listing_type', 'for_sale')->latest()->take(6)->get(self::CARD_COLUMNS),
                'long_term_rent' => $this->listings()->where('listing_type', 'long_term_rent')->latest()->take(6)->get(self::CARD_COLUMNS),
            ],
            'counts'   => [
                'for_sale'        => (int) ($counts['for_sale'] ?? 0),
                'long_term_rent'  => (int) ($counts['long_term_rent'] ?? 0),
                'short_term_stay' => (int) ($counts['short_term_stay'] ?? 0),
            ],
            'agents' => $agents,
        ]);
    }

    public function listingsIndex(Request $request): Response
    {
        $filters = $request->validate([
            'listing_type'  => ['nullable', 'in:for_sale,long_term_rent,short_term_stay'],
            'property_type' => ['nullable', 'in:apartment,house,townhouse,commercial,land,other'],
            'q'             => ['nullable', 'string', 'max:120'],
            'bedrooms'      => ['nullable', 'integer', 'min:0', 'max:10'],
            'price_min'     => ['nullable', 'numeric', 'min:0'],
            'price_max'     => ['nullable', 'numeric', 'min:0'],
        ]);

        $query = $this->listings();
        $priceColumn = match ($filters['listing_type'] ?? null) {
            'long_term_rent'  => 'monthly_rent',
            'short_term_stay' => 'short_stay_nightly_price',
            default           => 'sale_price',
        };
        if (! empty($filters['price_min'])) {
            $query->where($priceColumn, '>=', $filters['price_min']);
        }
        if (! empty($filters['price_max'])) {
            $query->where($priceColumn, '<=', $filters['price_max']);
        }
        if (! empty($filters['listing_type'])) {
            $query->where('listing_type', $filters['listing_type']);
        }
        if (! empty($filters['property_type'])) {
            $query->where('property_type', $filters['property_type']);
        }
        if (! empty($filters['bedrooms'])) {
            $query->where('bedrooms', '>=', $filters['bedrooms']);
        }
        if (! empty($filters['q'])) {
            $q = '%'.$filters['q'].'%';
            $query->where(fn ($w) => $w->where('suburb', 'like', $q)->orWhere('city', 'like', $q)->orWhere('title', 'like', $q));
        }

        return $this->render('Site/Listings/Index', [
            'listings' => $query->latest()->paginate(12, self::CARD_COLUMNS)->withQueryString(),
            'filters'  => $filters,
        ], ['title' => 'Properties · '.$this->site->agency->name]);
    }

    public function listingShow(string $slug): Response
    {
        $listing = $this->listings()->where('slug', $slug)->with(['agent:id,name,email,phone,avatar', 'units'])->firstOrFail();
        $listing->increment('views_count');

        $agent = $listing->agent;
        $pivot = $agent ? AgencyAgent::where('agency_id', $this->site->agency_id)->where('user_id', $agent->id)->first() : null;
        $agency = $this->site->agency;

        return $this->render('Site/Listings/Show', [
            'listing' => $listing,
            'contact' => [
                'id'     => $agent?->id,
                'name'   => $agent?->name ?? $agency->name,
                'email'  => $agent?->email ?? $agency->email,
                'phone'  => $agent?->phone ?? $agency->phone,
                'avatar' => AgencyWebsite::publicUrl($agent?->avatar),
                'slug'   => $pivot && $pivot->show_on_website ? $this->ensureSlug($pivot)->public_slug : null,
            ],
            'similar' => $this->listings()->where('id', '!=', $listing->id)->where('listing_type', $listing->listing_type)->latest()->take(3)->get(self::CARD_COLUMNS),
        ], [
            'title'       => $listing->title.' · '.$agency->name,
            'description' => Str::limit(strip_tags((string) $listing->description), 160) ?: $listing->title,
            'image'       => $listing->primary_image,
        ]);
    }

    public function agentsIndex(): Response
    {
        abort_unless($this->site->show_agents, 404);

        $counts = $this->listings()->selectRaw('agent_id, COUNT(*) as total')->groupBy('agent_id')->pluck('total', 'agent_id');

        return $this->render('Site/Agents/Index', [
            'agents' => $this->agents()->map(fn ($a) => $this->agentCard($a, (int) ($counts[$a->user_id] ?? 0)))->values(),
        ], ['title' => 'Our agents · '.$this->site->agency->name]);
    }

    public function agentShow(string $slug): Response
    {
        abort_unless($this->site->show_agents, 404);

        $pivot = $this->agents()->firstWhere('public_slug', $slug);
        abort_unless($pivot, 404);

        return $this->render('Site/Agents/Show', [
            'agent'    => $this->agentCard($pivot),
            'listings' => $this->listings()->where('agent_id', $pivot->user_id)->latest()->get(self::CARD_COLUMNS),
        ], ['title' => $pivot->user->name.' · '.$this->site->agency->name]);
    }

    public function about(): Response
    {
        return $this->render('Site/About', [
            'about' => $this->site->about,
            'stats' => [
                'listings' => $this->listings()->count(),
                'agents'   => $this->agents()->count(),
            ],
        ], ['title' => 'About · '.$this->site->agency->name]);
    }

    public function contact(Request $request): Response
    {
        return $this->render('Site/Contact', [
            'intent' => $request->query('intent') === 'sell' ? 'sell' : 'general',
        ], ['title' => 'Contact · '.$this->site->agency->name]);
    }

    /** POST /contact — general or valuation enquiry (no listing) into the agency pipeline. */
    public function contactSubmit(Request $request, InquiryService $service): RedirectResponse
    {
        $data = $request->validate([
            'intent'  => ['required', 'in:general,sell,let'],
            'name'    => ['required', 'string', 'max:120'],
            'email'   => ['required', 'email', 'max:180'],
            'phone'   => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string', 'max:240'],
            'message' => ['nullable', 'string', 'max:2000'],
        ]);

        $lines = [match ($data['intent']) {
            'sell'  => 'Valuation request: thinking of selling',
            'let'   => 'Valuation request: thinking of letting',
            default => 'General enquiry from the agency website',
        }];
        if (! empty($data['address'])) {
            $lines[] = 'Property: '.$data['address'];
        }
        if (! empty($data['message'])) {
            array_push($lines, '', $data['message']);
        }

        $service->createAgencyEnquiry($this->site->agency, [
            'name'              => $data['name'],
            'email'             => $data['email'],
            'phone'             => $data['phone'] ?? null,
            'message'           => implode("\n", $lines),
            'agency_website_id' => $this->site->id,
        ]);

        return back()->with('success', 'Thank you — one of our agents will be in touch shortly.');
    }

    /** POST /inquiries on the site host — same pipeline as the portal, attributed to this site. */
    public function inquiry(Request $request, InquiryService $service): RedirectResponse
    {
        $data = $request->validate([
            'listing_id'      => ['required', 'integer'],
            'listing_unit_id' => ['nullable', 'integer', 'exists:listing_units,id'],
            'name'            => ['required', 'string', 'max:120'],
            'email'           => ['required', 'email', 'max:180'],
            'phone'           => ['nullable', 'string', 'max:30'],
            'message'         => ['nullable', 'string', 'max:2000'],
            'agent_id'        => ['nullable', 'integer'],
        ]);

        $listing = $this->listings()->findOrFail($data['listing_id']);

        $service->createFromWebsite([
            ...$data,
            'listing_id'         => $listing->id,
            'user_id'            => $request->user()?->id,
            'source'             => 'website',
            'agency_website_id'  => $this->site->id,
            'preferred_agent_id' => $data['agent_id'] ?? null,
        ]);

        return back()->with('success', 'Thanks! Your enquiry has been sent — we\'ll be in touch shortly.');
    }

    public function tourRequest(Request $request, InquiryService $service): RedirectResponse
    {
        $data = $request->validate([
            'listing_id' => ['required', 'integer'],
            'tour_type'  => ['required', 'string', 'in:in_person,video_chat'],
            'date'       => ['required', 'date', 'after_or_equal:today'],
            'time'       => ['required', 'string', 'max:20'],
            'name'       => ['required', 'string', 'max:120'],
            'phone'      => ['nullable', 'string', 'max:30'],
            'email'      => ['required', 'email', 'max:180'],
            'message'    => ['nullable', 'string', 'max:2000'],
            'terms'      => ['accepted'],
        ]);

        $listing = $this->listings()->findOrFail($data['listing_id']);

        $tourLabel = $data['tour_type'] === 'video_chat' ? 'Video chat tour' : 'In-person tour';
        try {
            $viewingAt = Carbon::parse($data['date'].' '.$data['time']);
        } catch (\Throwable) {
            $viewingAt = Carbon::parse($data['date']);
        }
        $lines = ["Tour request: {$tourLabel}", 'Requested slot: '.Carbon::parse($data['date'])->format('D, d M Y')." at {$data['time']}"];
        if (! empty($data['message'])) {
            array_push($lines, '', $data['message']);
        }

        $service->createTourRequest([
            'listing_id'           => $listing->id,
            'name'                 => $data['name'],
            'email'                => $data['email'],
            'phone'                => $data['phone'] ?? null,
            'message'              => implode("\n", $lines),
            'user_id'              => $request->user()?->id,
            'viewing_scheduled_at' => $viewingAt,
            'agency_website_id'    => $this->site->id,
        ]);

        return back()->with('success', 'Your tour request has been sent — the agent will confirm your slot shortly.');
    }

    public function sitemap(): HttpResponse
    {
        $urls = collect(['/', '/properties', '/about', '/contact'])
            ->merge($this->site->show_agents ? ['/agents'] : [])
            ->map(fn ($p) => ['loc' => $this->site->url($p), 'lastmod' => null]);

        $this->listings()->get(['slug', 'updated_at'])->each(fn ($l) => $urls->push([
            'loc' => $this->site->url('/properties/'.$l->slug), 'lastmod' => $l->updated_at?->toAtomString(),
        ]));
        if ($this->site->show_agents) {
            $this->agents()->each(fn ($a) => $urls->push(['loc' => $this->site->url('/agents/'.$a->public_slug), 'lastmod' => null]));
        }

        $xml = '<?xml version="1.0" encoding="UTF-8"?>'."\n".'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
        foreach ($urls as $u) {
            $xml .= '<url><loc>'.e($u['loc']).'</loc>'.($u['lastmod'] ? '<lastmod>'.$u['lastmod'].'</lastmod>' : '').'</url>';
        }
        $xml .= '</urlset>';

        return response($xml, 200, ['Content-Type' => 'application/xml']);
    }

    public function robots(): HttpResponse
    {
        $body = $this->site->isPublished()
            ? "User-agent: *\nAllow: /\nSitemap: ".$this->site->url('/sitemap.xml')."\n"
            : "User-agent: *\nDisallow: /\n";

        return response($body, 200, ['Content-Type' => 'text/plain']);
    }
}
