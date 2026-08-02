<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\Listing;
use App\Support\CityRegions;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    public function __invoke(): Response
    {
        $featured = Listing::query()
            ->where('status', 'available')
            ->whereNull('deleted_at')
            ->latest()
            ->take(6)
            ->get([
                'id', 'slug', 'title', 'listing_type', 'property_type',
                'suburb', 'city', 'bedrooms', 'bathrooms', 'area_sqm',
                'primary_image', 'sale_price', 'monthly_rent', 'short_stay_nightly_price',
            ]);

        // Group raw per-city counts into metro regions (e.g. Midrand, Boksburg
        // and Benoni roll up into Johannesburg) so the Explore Cities tiles
        // show one tile per metro. Listings keep their real city in the DB.
        $cities = Listing::query()
            ->where('status', 'available')
            ->whereNull('deleted_at')
            ->selectRaw('city, COUNT(*) as total')
            ->whereNotNull('city')
            ->groupBy('city')
            ->get()
            ->groupBy(fn ($row) => CityRegions::regionFor($row->city))
            ->map(fn ($rows, $region) => [
                'city'  => $region,
                'total' => (int) $rows->sum('total'),
            ])
            ->sortByDesc('total')
            ->take(4)
            ->values();

        return Inertia::render('Public/Home', [
            'featured' => $featured,
            'cities' => $cities,
            'totals' => [
                'listings' => Listing::where('status', 'available')->whereNull('deleted_at')->count(),
                'agencies' => \App\Models\Agency::where('status', 'active')->count(),
                'contractors' => \App\Models\Contractor::where('status', 'active')->count(),
            ],
        ]);
    }
}
