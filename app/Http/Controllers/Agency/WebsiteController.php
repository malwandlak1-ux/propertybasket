<?php

namespace App\Http\Controllers\Agency;

use App\Http\Controllers\Agency\Concerns\ResolvesAgency;
use App\Http\Controllers\Controller;
use App\Http\Middleware\ResolveAgencySite;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\AgencyWebsite;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * /agency/website — the agency admin's control panel for their generated
 * website: subdomain, template, branding/content, agent profiles, custom
 * domain and publish state. The site itself is served by routes/sites.php.
 */
class WebsiteController extends Controller
{
    use ResolvesAgency;

    /** Only the agency owner (not its agents) manages the website. */
    private function ownedAgency(Request $request): Agency
    {
        $agency = $this->resolveAgency($request);
        abort_unless($agency->user_id === $request->user()->id, 403, 'Only the agency owner can manage the website.');

        return $agency;
    }

    /** Every agency gets a draft site on first visit, on a free subdomain derived from its slug. */
    private function websiteFor(Agency $agency): AgencyWebsite
    {
        return $agency->agencyWebsite ?? AgencyWebsite::create([
            'agency_id' => $agency->id,
            'subdomain' => $this->suggestSubdomain($agency),
            'template'  => 'portal',
            'status'    => 'draft',
            'tagline'   => null,
        ]);
    }

    private function suggestSubdomain(Agency $agency): string
    {
        $base = Str::limit(Str::slug($agency->slug ?: $agency->name), 50, '') ?: 'agency';
        if (in_array($base, AgencyWebsite::RESERVED_SUBDOMAINS, true)) {
            $base .= '-agency';
        }
        $sub = $base;
        $i = 2;
        while (AgencyWebsite::where('subdomain', $sub)->exists()) {
            $sub = $base.'-'.$i++;
        }

        return $sub;
    }

    public function show(Request $request): Response
    {
        $agency = $this->ownedAgency($request);
        $site = $this->websiteFor($agency);

        $agents = AgencyAgent::with('user:id,name,email,avatar')
            ->where('agency_id', $agency->id)
            ->where('status', 'active')
            ->orderBy('id')
            ->get()
            ->filter(fn ($a) => $a->user)
            ->map(fn ($a) => [
                'id'              => $a->id,
                'name'            => $a->user->name,
                'email'           => $a->user->email,
                'avatar'          => AgencyWebsite::publicUrl($a->user->avatar),
                'bio'             => $a->bio,
                'show_on_website' => (bool) $a->show_on_website,
            ])->values();

        $liveListings = \App\Models\Listing::publiclyVisible()->forAgency($agency)->count();

        return Inertia::render('Agency/Website', [
            'agency' => [
                'name'  => $agency->name,
                'logo'  => AgencyWebsite::publicUrl($agency->logo),
                'email' => $agency->email,
                'phone' => $agency->phone,
            ],
            'website' => [
                'subdomain'          => $site->subdomain,
                'subdomain_host'     => $site->subdomainHost(),
                'custom_domain'      => $site->custom_domain,
                'domain_status'      => $site->domain_status,
                'template'           => $site->template,
                'status'             => $site->status,
                'primary_color'      => $site->primary_color ?: '#F26A1B',
                'accent_color'       => $site->accent_color ?: '#1F2937',
                'hero_image'         => AgencyWebsite::publicUrl($site->hero_image),
                'hero_heading'       => $site->hero_heading,
                'tagline'            => $site->tagline,
                'about'              => $site->about,
                'social_links'       => (object) ($site->social_links ?? []),
                'seo_title'          => $site->seo_title,
                'seo_description'    => $site->seo_description,
                'show_agents'        => (bool) $site->show_agents,
                'analytics_id'       => $site->analytics_id,
                'published_at'       => $site->published_at?->toIso8601String(),
                'url'                => $site->url(),
                'preview_url'        => $site->url('/?preview='.ResolveAgencySite::previewToken($site)),
            ],
            'agents'        => $agents,
            'images'        => [
                'hero'  => AgencyWebsite::publicUrl($site->hero_image),
                'about' => AgencyWebsite::publicUrl($site->customImage('about')),
                'cta'   => AgencyWebsite::publicUrl($site->customImage('cta')),
                'why'   => AgencyWebsite::publicUrl($site->customImage('why')),
                // Automatic fallback shown when a slot has no upload.
                'auto'  => \App\Models\Listing::publiclyVisible()->forAgency($agency)->whereNotNull('primary_image')->latest()->value('primary_image'),
                'types' => $site->typeTiles(12),
                'areas' => $site->areaTiles(12),
            ],
            'live_listings' => $liveListings,
            'templates'     => AgencyWebsite::TEMPLATES,
            'dns'           => [
                'cname_target' => config('sites.cname_target'),
                'server_ip'    => config('sites.server_ip'),
            ],
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $agency = $this->ownedAgency($request);
        $site = $this->websiteFor($agency);

        $request->merge(['subdomain' => $request->filled('subdomain') ? $request->input('subdomain') : $site->subdomain]);

        $data = $request->validate([
            'subdomain'       => [
                'required', 'string', 'min:3', 'max:63', 'regex:/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/',
                Rule::notIn(AgencyWebsite::RESERVED_SUBDOMAINS),
                Rule::unique('agency_websites', 'subdomain')->ignore($site->id),
            ],
            'template'        => ['required', Rule::in(AgencyWebsite::TEMPLATES)],
            'primary_color'   => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'accent_color'    => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'hero_heading'    => ['nullable', 'string', 'max:160'],
            'tagline'         => ['nullable', 'string', 'max:200'],
            'about'           => ['nullable', 'string', 'max:5000'],
            'social_links'    => ['nullable', 'array'],
            'social_links.facebook'  => ['nullable', 'url', 'max:255'],
            'social_links.instagram' => ['nullable', 'url', 'max:255'],
            'social_links.linkedin'  => ['nullable', 'url', 'max:255'],
            'social_links.x'         => ['nullable', 'url', 'max:255'],
            'social_links.youtube'   => ['nullable', 'url', 'max:255'],
            'social_links.tiktok'    => ['nullable', 'url', 'max:255'],
            'social_links.whatsapp'  => ['nullable', 'string', 'max:30'],
            'seo_title'       => ['nullable', 'string', 'max:70'],
            'seo_description' => ['nullable', 'string', 'max:170'],
            'show_agents'     => ['nullable', 'boolean'],
            'analytics_id'    => ['nullable', 'regex:/^G-[A-Z0-9]{4,20}$/'],
            'hero_image'      => ['nullable', 'image', 'mimes:png,jpg,jpeg,webp', 'max:4096'],
            'remove_hero'     => ['nullable', 'boolean'],
        ], [
            'subdomain.regex'  => 'Use lowercase letters, numbers and hyphens only (no hyphen at the start or end).',
            'subdomain.not_in' => 'That address is reserved — please choose another.',
            'subdomain.unique' => 'That address is already taken.',
        ]);

        if ($request->hasFile('hero_image')) {
            $this->deleteStored($site->hero_image);
            $data['hero_image'] = Storage::url($request->file('hero_image')->store("agencies/{$agency->id}/website", 'public'));
        } elseif ($request->boolean('remove_hero')) {
            $this->deleteStored($site->hero_image);
            $data['hero_image'] = null;
        } else {
            unset($data['hero_image']);
        }
        unset($data['remove_hero']);

        $data['subdomain'] = strtolower($data['subdomain']);
        $data['show_agents'] = $request->boolean('show_agents', true);
        $data['social_links'] = array_filter((array) ($data['social_links'] ?? []));

        $site->update($data);

        return back()->with('success', 'Website saved.');
    }

    /**
     * POST /agency/website/images — upload the photo for one section:
     * slot hero|about|cta|why, or type/area with a key (property type / suburb).
     */
    public function uploadImage(Request $request): RedirectResponse
    {
        $agency = $this->ownedAgency($request);
        $site = $this->websiteFor($agency);
        $data = $this->validateSlot($request, $site, true);

        $url = Storage::url($request->file('image')->store("agencies/{$agency->id}/website", 'public'));
        $this->putImage($site, $data['slot'], $data['key'] ?? null, $url);

        return back()->with('success', 'Image updated.');
    }

    /** POST /agency/website/images/remove — back to the automatic photo. */
    public function removeImage(Request $request): RedirectResponse
    {
        $site = $this->websiteFor($this->ownedAgency($request));
        $data = $this->validateSlot($request, $site, false);
        $this->putImage($site, $data['slot'], $data['key'] ?? null, null);

        return back()->with('success', 'Image reset — the automatic photo is used again.');
    }

    private function validateSlot(Request $request, AgencyWebsite $site, bool $withFile): array
    {
        $data = $request->validate([
            'slot'  => ['required', Rule::in([...AgencyWebsite::IMAGE_SLOTS, 'type', 'area'])],
            'key'   => ['required_if:slot,type,area', 'nullable', 'string', 'max:120'],
            'image' => $withFile ? ['required', 'image', 'mimes:png,jpg,jpeg,webp', 'max:4096'] : ['nullable'],
        ]);

        // A tile key must be a type / suburb the agency actually has listings in.
        if ($data['slot'] === 'type') {
            abort_unless(array_key_exists($data['key'], AgencyWebsite::TYPE_LABELS), 422, 'Unknown property type.');
        }
        if ($data['slot'] === 'area') {
            abort_unless($site->visibleListings()->where('suburb', $data['key'])->exists(), 422, 'That area has no listings.');
        }

        return $data;
    }

    private function putImage(AgencyWebsite $site, string $slot, ?string $key, ?string $url): void
    {
        $this->deleteStored($site->customImage($slot, $key));

        if ($slot === 'hero') {
            $site->update(['hero_image' => $url]);

            return;
        }

        $images = $site->images ?? [];
        if ($key === null) {
            $images[$slot] = $url;
        } else {
            $images[$slot.'s'][$key] = $url;
            $images[$slot.'s'] = array_filter($images[$slot.'s']);
        }
        $site->update(['images' => array_filter($images)]);
    }

    public function publish(Request $request): RedirectResponse
    {
        $site = $this->websiteFor($this->ownedAgency($request));
        $publish = $request->boolean('publish', true);

        $site->update([
            'status'       => $publish ? 'published' : 'draft',
            'published_at' => $publish ? ($site->published_at ?? now()) : $site->published_at,
        ]);

        return back()->with('success', $publish ? 'Your website is live.' : 'Your website is now offline (draft).');
    }

    public function updateAgent(Request $request, AgencyAgent $agencyAgent): RedirectResponse
    {
        $agency = $this->ownedAgency($request);
        abort_unless($agencyAgent->agency_id === $agency->id, 404);

        $data = $request->validate([
            'bio'             => ['nullable', 'string', 'max:2000'],
            'show_on_website' => ['required', 'boolean'],
        ]);
        $agencyAgent->update($data);

        return back()->with('success', 'Agent profile updated.');
    }

    /** Save a custom domain → pending. The agency then points DNS and clicks Verify. */
    public function saveDomain(Request $request): RedirectResponse
    {
        $site = $this->websiteFor($this->ownedAgency($request));

        $request->merge(['custom_domain' => $this->normaliseDomain((string) $request->input('custom_domain'))]);
        $data = $request->validate([
            'custom_domain' => [
                'nullable', 'string', 'max:253',
                'regex:/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/',
                Rule::unique('agency_websites', 'custom_domain')->ignore($site->id),
                function ($attr, $value, $fail) {
                    $base = strtolower(config('sites.base_domain'));
                    if ($value && ($value === $base || str_ends_with($value, '.'.$base))) {
                        $fail('Use your own domain — your free address is already set up.');
                    }
                },
            ],
        ], ['custom_domain.regex' => 'Enter a domain like www.youragency.co.za']);

        $domain = $data['custom_domain'] ?: null;
        $site->update([
            'custom_domain'      => $domain,
            'domain_status'      => $domain ? 'pending' : 'none',
            'domain_verified_at' => null,
        ]);

        return back()->with('success', $domain ? 'Domain saved — now update your DNS and click Verify.' : 'Custom domain removed.');
    }

    /** Check the domain's DNS points at us; on success it's queued for the platform team to switch on. */
    public function verifyDomain(Request $request): RedirectResponse
    {
        $site = $this->websiteFor($this->ownedAgency($request));
        abort_unless($site->custom_domain, 422, 'Add a custom domain first.');

        if (! $this->dnsPointsAtUs($site->custom_domain)) {
            return back()->with('error', "We couldn't see your DNS change yet. It can take up to 24 hours — try again later.");
        }

        if ($site->domain_status !== 'live') {
            $site->update(['domain_status' => 'verified', 'domain_verified_at' => now()]);
        }

        return back()->with('success', 'DNS verified! Our team will switch on your domain and SSL certificate shortly.');
    }

    private function dnsPointsAtUs(string $domain): bool
    {
        $target = strtolower(rtrim((string) config('sites.cname_target'), '.'));
        $ip = config('sites.server_ip');

        $records = @dns_get_record($domain, DNS_CNAME | DNS_A) ?: [];
        foreach ($records as $r) {
            if (($r['type'] ?? null) === 'CNAME' && strtolower(rtrim($r['target'] ?? '', '.')) === $target) {
                return true;
            }
            if (($r['type'] ?? null) === 'A' && $ip && ($r['ip'] ?? null) === $ip) {
                return true;
            }
        }

        // A CNAME target that resolves to the server IP also counts.
        if ($ip) {
            $resolved = @gethostbynamel($domain) ?: [];

            return in_array($ip, $resolved, true);
        }

        return false;
    }

    private function normaliseDomain(string $value): string
    {
        $value = strtolower(trim($value));
        $value = preg_replace('#^https?://#', '', $value);

        return rtrim(explode('/', $value)[0], '.');
    }

    private function deleteStored(?string $url): void
    {
        if ($url && str_starts_with($url, '/storage/')) {
            Storage::disk('public')->delete(substr($url, strlen('/storage/')));
        }
    }
}
