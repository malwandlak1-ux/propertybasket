<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class AgencyWebsite extends Model
{
    /** 'portal' (default, search-led), 'showcase' (bright, editorial portal) and 'minimal'. Unknown/legacy values render as portal. */
    public const TEMPLATES = ['portal', 'showcase', 'minimal'];

    /** Subdomains that can never be claimed by an agency. */
    public const RESERVED_SUBDOMAINS = [
        'www', 'manage', 'admin', 'api', 'app', 'mail', 'smtp', 'ftp', 'careline', 'prod',
        'staging', 'dev', 'test', 'sites', 'static', 'cdn', 'assets', 'help', 'support',
        'blog', 'status', 'dashboard', 'login', 'property-basket', 'propertybasket',
    ];

    protected $fillable = [
        'agency_id', 'subdomain', 'custom_domain', 'domain_status', 'domain_verified_at',
        'template', 'status', 'primary_color', 'accent_color', 'hero_image', 'hero_heading',
        'tagline', 'about', 'social_links', 'seo_title', 'seo_description', 'show_agents',
        'analytics_id', 'published_at',
    ];

    protected function casts(): array
    {
        return [
            'social_links' => 'array',
            'show_agents' => 'boolean',
            'published_at' => 'datetime',
            'domain_verified_at' => 'datetime',
        ];
    }

    public const TYPE_LABELS = [
        'house' => 'Houses', 'apartment' => 'Apartments', 'townhouse' => 'Townhouses',
        'commercial' => 'Commercial', 'land' => 'Land', 'other' => 'Other',
    ];

    /** This agency's publicly visible listings — the same rule as the main portal. */
    public function visibleListings()
    {
        return Listing::query()->publiclyVisible()->forAgency($this->agency_id);
    }

    /** Property types with stock: label, count and a representative photo. */
    public function typeTiles(int $limit = 6): array
    {
        return $this->visibleListings()
            ->selectRaw('property_type, COUNT(*) as total, MAX(primary_image) as image')
            ->groupBy('property_type')
            ->orderByDesc('total')
            ->take($limit)
            ->get()
            ->map(fn ($r) => [
                'type'  => $r->property_type,
                'label' => self::TYPE_LABELS[$r->property_type] ?? ucfirst((string) $r->property_type),
                'count' => (int) $r->total,
                'image' => $r->image,
            ])->values()->all();
    }

    /** Suburbs the agency has stock in, busiest first. */
    public function areaTiles(int $limit = 6): array
    {
        return $this->visibleListings()
            ->whereNotNull('suburb')
            ->selectRaw('suburb, MAX(city) as city, COUNT(*) as total, MAX(primary_image) as image')
            ->groupBy('suburb')
            ->orderByDesc('total')
            ->take($limit)
            ->get()
            ->map(fn ($r) => ['suburb' => $r->suburb, 'city' => $r->city, 'count' => (int) $r->total, 'image' => $r->image])
            ->values()->all();
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function isPublished(): bool
    {
        return $this->status === 'published';
    }

    /** The free platform address, e.g. sandton-realty.propertybasket.co.za */
    public function subdomainHost(): string
    {
        return $this->subdomain.'.'.config('sites.base_domain');
    }

    /** The address visitors should use — the custom domain once it's live. */
    public function primaryHost(): string
    {
        return $this->custom_domain && $this->domain_status === 'live'
            ? $this->custom_domain
            : $this->subdomainHost();
    }

    public function url(string $path = '/'): string
    {
        $port = config('sites.port');

        return config('sites.scheme').'://'.$this->primaryHost().($port ? ':'.$port : '').'/'.ltrim($path, '/');
    }

    /** Resolve a stored path (public disk) or absolute URL to something an <img> can load. */
    public static function publicUrl(?string $path): ?string
    {
        if (! $path) {
            return null;
        }
        if (str_starts_with($path, 'http') || str_starts_with($path, '/')) {
            return $path;
        }

        return Storage::disk('public')->url($path);
    }
}
