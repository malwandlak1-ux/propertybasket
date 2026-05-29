<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\Agency;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class AgencyController extends Controller
{
    public function index(): Response
    {
        $agencies = Agency::query()
            ->where('status', 'active')
            ->withCount(['listings' => fn ($q) => $q->where('status', 'available')->whereNull('deleted_at')])
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'email', 'phone', 'head_office_address', 'logo']);

        return Inertia::render('Public/Agencies/Index', [
            'agencies' => $agencies,
        ]);
    }

    public function show(string $slug): Response
    {
        $agency = Agency::query()
            ->where('slug', $slug)
            ->where('status', 'active')
            ->with(['agents:id,name,email,phone'])
            ->first();

        if (! $agency) {
            throw new NotFoundHttpException('Agency not found.');
        }

        $listings = $agency->listings()
            ->where('status', 'available')
            ->whereNull('deleted_at')
            ->latest()
            ->take(24)
            ->get([
                'id', 'slug', 'title', 'listing_type', 'property_type',
                'suburb', 'city', 'bedrooms', 'bathrooms', 'area_sqm',
                'primary_image', 'sale_price', 'monthly_rent', 'short_stay_nightly_price',
            ]);

        return Inertia::render('Public/Agencies/Show', [
            'agency' => $agency,
            'listings' => $listings,
        ]);
    }
}
