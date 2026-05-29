<?php

namespace App\Http\Controllers\Landlord;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Landlord\Concerns\ResolvesLandlord;
use App\Models\Landlord;
use App\Models\Listing;
use App\Models\ListingUnit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Landlord-side create listing — the listing is owned by the Landlord record
 * (owner_type=Landlord::class). No agent assignment (landlord self-manages).
 */
class ListingsController extends Controller
{
    use ResolvesLandlord;

    private const AMENITY_GROUPS = [
        'interior' => ['Air Conditioning', 'Furnished', 'Fireplace', 'Built-in cupboards', 'Open-plan kitchen'],
        'kitchen'  => ['Dishwasher', 'Modern Appliances', 'Gas stove', 'Scullery', 'Walk-in pantry'],
        'exterior' => ['Swimming Pool', 'Garden', 'Garage', 'Balcony', 'Carport', 'Patio', 'Braai area'],
        'safety'   => ['24/7 Security', 'Alarm System', 'Electric Fence', 'CCTV', 'Burglar bars'],
        'comfort'  => ['Solar Power', 'Borehole', 'Generator', 'Fibre Internet'],
    ];

    public function create(Request $request): Response
    {
        $landlord = $this->resolveLandlord($request);
        $user     = $request->user();

        return Inertia::render('Landlord/CreateListing', [
            'landlord'  => ['id' => $landlord->id, 'name' => $user->name],
            'agents'    => [],
            'amenities' => self::AMENITY_GROUPS,
            'property_types' => [
                ['value' => 'apartment',  'label' => 'Apartment'],
                ['value' => 'house',      'label' => 'House'],
                ['value' => 'townhouse',  'label' => 'Townhouse'],
                ['value' => 'commercial', 'label' => 'Commercial'],
                ['value' => 'land',       'label' => 'Land / Plot'],
                ['value' => 'other',      'label' => 'Other'],
            ],
            'provinces' => [
                'Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape',
                'Free State', 'Mpumalanga', 'Limpopo', 'North West', 'Northern Cape',
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $landlord = $this->resolveLandlord($request);

        $data = $request->validate([
            'listing_type'        => ['required', 'in:for_sale,long_term_rent'],
            'title'               => ['required', 'string', 'max:200'],
            'property_type'       => ['required', 'in:apartment,house,townhouse,commercial,land,other'],
            'description'         => ['nullable', 'string', 'max:5000'],
            'listing_structure'   => ['required', 'in:single_unit,multi_unit'],
            'sale_price'          => ['nullable', 'numeric', 'min:0', 'required_if:listing_type,for_sale'],
            'monthly_rent'        => ['nullable', 'numeric', 'min:0'],
            'bedrooms'            => ['nullable', 'integer', 'min:0', 'max:50'],
            'bathrooms'           => ['nullable', 'numeric', 'min:0', 'max:50'],
            'area_sqm'            => ['nullable', 'numeric', 'min:0'],
            'units'               => ['nullable', 'array'],
            'units.*.unit_number' => ['required_with:units', 'string', 'max:40'],
            'units.*.monthly_rent'=> ['required_with:units', 'numeric', 'min:0'],
            'units.*.bedrooms'    => ['nullable', 'integer', 'min:0', 'max:20'],
            'units.*.bathrooms'   => ['nullable', 'numeric', 'min:0', 'max:20'],
            'units.*.area_sqm'    => ['nullable', 'numeric', 'min:0'],
            'address'             => ['nullable', 'string', 'max:255'],
            'suburb'              => ['nullable', 'string', 'max:120'],
            'city'                => ['nullable', 'string', 'max:120'],
            'province'            => ['nullable', 'string', 'max:80'],
            'postal_code'         => ['nullable', 'string', 'max:12'],
            'latitude'            => ['nullable', 'numeric', 'between:-90,90'],
            'longitude'           => ['nullable', 'numeric', 'between:-180,180'],
            'amenities'           => ['nullable', 'array'],
            'amenities.*'         => ['string', 'max:80'],
            'custom_amenities'    => ['nullable', 'array'],
            'custom_amenities.*'  => ['string', 'max:80'],
            'primary_image'       => ['nullable', 'image', 'max:5120'],
            'gallery_images'      => ['nullable', 'array', 'max:50'],
            'gallery_images.*'    => ['image', 'max:5120'],
            'negotiator_protocol' => ['nullable', 'boolean'],
        ]);

        $listing = DB::transaction(function () use ($data, $landlord, $request) {
            $listing = Listing::create([
                'ulid'                => (string) Str::ulid(),
                'owner_type'          => Landlord::class,
                'owner_id'            => $landlord->id,
                'agent_id'            => null, // landlord self-manages
                'title'               => $data['title'],
                'slug'                => $this->uniqueSlug($data['title']),
                'description'         => $data['description'] ?? null,
                'listing_type'        => $data['listing_type'],
                'property_type'       => $data['property_type'],
                'status'              => 'available',
                'sale_price'          => $data['listing_type'] === 'for_sale' ? ($data['sale_price'] ?? null) : null,
                'monthly_rent'        => $data['listing_type'] === 'long_term_rent' && $data['listing_structure'] === 'single_unit'
                    ? ($data['monthly_rent'] ?? null) : null,
                'listing_structure'   => $data['listing_structure'],
                'negotiator_protocol' => $request->boolean('negotiator_protocol'),
                'address'             => $data['address'] ?? null,
                'suburb'              => $data['suburb'] ?? null,
                'city'                => $data['city'] ?? null,
                'province'            => $data['province'] ?? null,
                'postal_code'         => $data['postal_code'] ?? null,
                'latitude'            => $data['latitude'] ?? null,
                'longitude'           => $data['longitude'] ?? null,
                'bedrooms'            => $data['bedrooms'] ?? null,
                'bathrooms'           => $data['bathrooms'] ?? null,
                'area_sqm'            => $data['area_sqm'] ?? null,
                'amenities'           => array_values(array_filter(array_merge(
                    $data['amenities'] ?? [],
                    $data['custom_amenities'] ?? [],
                ))),
            ]);

            if ($data['listing_structure'] === 'multi_unit' && ! empty($data['units'])) {
                foreach ($data['units'] as $u) {
                    ListingUnit::create([
                        'listing_id'   => $listing->id,
                        'unit_number'  => $u['unit_number'],
                        'monthly_rent' => $u['monthly_rent'],
                        'bedrooms'     => $u['bedrooms'] ?? null,
                        'bathrooms'    => $u['bathrooms'] ?? null,
                        'area_sqm'     => $u['area_sqm'] ?? null,
                        'status'       => 'vacant',
                    ]);
                }
            }

            $dir = "listings/{$listing->id}";
            if ($request->hasFile('primary_image')) {
                $listing->primary_image = Storage::url($request->file('primary_image')->store($dir, 'public'));
            }
            if ($request->hasFile('gallery_images')) {
                $gallery = [];
                foreach ($request->file('gallery_images') as $file) {
                    $gallery[] = Storage::url($file->store($dir, 'public'));
                }
                $listing->gallery_images = $gallery;
            }

            $listing->save();
            $landlord->increment('property_count');
            return $listing;
        });

        return redirect()
            ->route('landlord.properties.index')
            ->with('success', "Listing \"{$listing->title}\" was added to your portfolio.");
    }

    private function uniqueSlug(string $title): string
    {
        $base = Str::slug($title);
        if (! Listing::where('slug', $base)->exists()) return $base;
        $i = 2;
        while (Listing::where('slug', "{$base}-{$i}")->exists()) $i++;
        return "{$base}-{$i}";
    }
}
