<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\Listing;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ListingController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'listing_type'  => ['nullable', 'in:for_sale,long_term_rent,short_term_stay'],
            'property_type' => ['nullable', 'in:apartment,house,townhouse,commercial,land,other'],
            'suburb'        => ['nullable', 'string', 'max:120'],
            'city'          => ['nullable', 'string', 'max:120'],
            'bedrooms'      => ['nullable', 'integer', 'min:0', 'max:10'],
            'price_min'     => ['nullable', 'numeric', 'min:0'],
            'price_max'     => ['nullable', 'numeric', 'min:0'],
        ]);

        $query = Listing::query()
            ->where('status', 'available')
            ->whereNull('deleted_at');

        if (! empty($filters['listing_type'])) {
            $query->where('listing_type', $filters['listing_type']);
        }
        if (! empty($filters['property_type'])) {
            $query->where('property_type', $filters['property_type']);
        }
        if (! empty($filters['suburb'])) {
            $query->where('suburb', 'like', '%'.$filters['suburb'].'%');
        }
        if (! empty($filters['city'])) {
            $query->where('city', 'like', '%'.$filters['city'].'%');
        }
        if (! empty($filters['bedrooms'])) {
            $query->where('bedrooms', '>=', $filters['bedrooms']);
        }

        // Price filter applies to the relevant column per listing_type.
        $type = $filters['listing_type'] ?? null;
        $priceColumn = match ($type) {
            'for_sale' => 'sale_price',
            'short_term_stay' => 'short_stay_nightly_price',
            'long_term_rent' => 'monthly_rent',
            default => null,
        };
        if ($priceColumn) {
            if (! empty($filters['price_min'])) {
                $query->where($priceColumn, '>=', $filters['price_min']);
            }
            if (! empty($filters['price_max'])) {
                $query->where($priceColumn, '<=', $filters['price_max']);
            }
        }

        $listings = $query
            ->latest()
            ->paginate(12)
            ->withQueryString();

        return Inertia::render('Public/Listings/Index', [
            'listings' => $listings,
            'filters' => $filters,
        ]);
    }

    public function show(string $slug): Response
    {
        $listing = Listing::query()
            ->where('slug', $slug)
            ->where('status', 'available')
            ->whereNull('deleted_at')
            ->with(['owner', 'agent', 'units'])
            ->first();

        if (! $listing) {
            throw new NotFoundHttpException('Listing not found.');
        }

        $listing->increment('views_count');

        $contact = null;
        if ($listing->owner_type === Agency::class) {
            $agent = $listing->agent;
            $agency = $listing->owner;
            $contact = [
                'kind' => 'agent',
                'name' => $agent?->name ?? $agency?->name,
                'email' => $agent?->email ?? $agency?->email,
                'phone' => $agent?->phone ?? $agency?->phone,
                'avatar' => $agent?->avatar ?? $agency?->logo,
                'agency_name' => $agency?->name,
                'agency_slug' => $agency?->slug,
            ];
        } else {
            $landlordOwner = $listing->owner?->user;
            $contact = [
                'kind' => 'landlord',
                'name' => $landlordOwner?->name,
                'email' => $landlordOwner?->email,
                'phone' => $landlordOwner?->phone,
                'avatar' => $landlordOwner?->avatar,
                'agency_name' => null,
                'agency_slug' => null,
            ];
        }

        return Inertia::render('Public/Listings/Show', [
            'listing' => $listing,
            'contact' => $contact,
        ]);
    }
}
