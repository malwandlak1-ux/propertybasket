<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeds a single real-world-style listing (modelled on the 160@Brooklyn
 * development in Nieuw Muckleneuk, Pretoria, listed on
 * plusgroupdirect.co.za) under the Sandton Realty agency. Images are
 * localised under public/images/brooklyn160/. Idempotent via slug.
 */
class Brooklyn160ListingSeeder extends Seeder
{
    /** All gallery images, localised under public/images/brooklyn160/. */
    private const IMAGE_FILES = [
        'brooklyn160-2437.jpg',        'brooklyn160-2438.jpg',        'brooklyn160-2439.jpg',        'brooklyn160-2440.jpg',        'brooklyn160-2441.jpg',
        'brooklyn160-2442.jpg',        'brooklyn160-2443.jpg',        'brooklyn160-2444.jpg',        'brooklyn160-2445.jpg',        'brooklyn160-2446.jpg',
        'brooklyn160-2447.jpg',        'brooklyn160-2448.jpg',        'brooklyn160-2449.jpg',        'brooklyn160-2450.jpg',        'brooklyn160-2451.jpg',
        'brooklyn160-2452.jpg',        'brooklyn160-2453.jpg',        'brooklyn160-2454.jpg',        'brooklyn160-2455.jpg',        'brooklyn160-2456.jpg',
    ];

    public function run(): void
    {
        // Prod: target a specific agency by its owner's email via env var
        //   BROOKLYN_OWNER_EMAIL=info@propertybasket.co.za php artisan db:seed --class=Brooklyn160ListingSeeder --force
        // Local: default to the Sandton Realty demo agency with Sipho as the agent.
        $ownerEmail = getenv('BROOKLYN_OWNER_EMAIL') ?: null;

        if ($ownerEmail) {
            $owner = User::where('email', $ownerEmail)->first();
            if (! $owner) {
                $this->command?->error("No user found for BROOKLYN_OWNER_EMAIL={$ownerEmail}.");
                return;
            }
            $agency  = Agency::where('user_id', $owner->id)->first();
            $agentId = $owner->id;
        } else {
            $agency  = Agency::where('slug', 'sandton-realty')->first();
            $agentId = User::where('email', 'sipho@sandton-realty.test')->value('id');
        }

        if (! $agency) {
            $this->command?->error('Target agency not found — check BROOKLYN_OWNER_EMAIL, or run DemoDataSeeder locally.');
            return;
        }

        $gallery = array_map(fn (string $f) => '/images/brooklyn160/' . $f, self::IMAGE_FILES);

        $description = <<<TXT
160@Brooklyn is a brand-new development in the ever-popular Nieuw Muckleneuk area of Pretoria East. Come home to a spacious and modern luxury home, close to Brooklyn Mall, renowned restaurants, schools and universities. Light a braai or relax in the pool on the rooftop terrace with spectacular views all around.

Three unit types are available, each with 2 dedicated parking bays:
• Type A — 2 bedrooms, 2 bathrooms, 75 m², from R1,875,000
• Type B — 3 bedrooms, 2 bathrooms, 98 m², from R2,145,000
• Type C — 3 bedrooms, 2 bathrooms, 112 m², from R2,250,000

Every home is fibre-ready (Wi-Fi ready through Crisp Fibre) with prepaid electricity and full bathrooms. The development offers 24-hour security with a guardhouse, cellphone-based access control, on-site braai facilities and a rooftop braai and swimming pool area. A combined household income from approximately R41,670 per month is recommended for bond approval, depending on the unit type.
TXT;

        Listing::updateOrCreate(
            ['slug' => '160-brooklyn-nieuw-muckleneuk'],
            [
                'ulid'          => (string) Str::ulid(),
                'owner_type'    => Agency::class,
                'owner_id'      => $agency->id,
                'agent_id'      => $agentId,

                'title'         => '160@Brooklyn – 3 Bed Apartment in Nieuw Muckleneuk, Pretoria',
                'description'   => $description,

                'listing_type'  => 'for_sale',
                'property_type' => 'apartment',
                'status'        => 'available',

                'sale_price'    => 2_250_000,

                'address'       => '160@Brooklyn, Nieuw Muckleneuk',
                'suburb'        => 'Nieuw Muckleneuk',
                'city'          => 'Pretoria',
                'province'      => 'Gauteng',
                'postal_code'   => '0181',
                'latitude'      => -25.7720,
                'longitude'     => 28.2280,

                'bedrooms'      => 3,
                'bathrooms'     => 2,
                'area_sqm'      => 112,

                'amenities' => [
                    'Security'         => ['24-hour security with guardhouse', 'Cellphone access control', 'Tight security'],
                    'Interior'         => ['Full bathrooms', 'Fibre-ready (Crisp Fibre)', 'Prepaid electricity'],
                    'Exterior'         => ['2x dedicated parking bays', 'On-site braai facilities'],
                    'Estate lifestyle' => ['Rooftop braai & swimming pool area', 'Rooftop terrace with views'],
                ],

                'primary_image'  => '/images/brooklyn160/brooklyn160-2437.jpg',
                'gallery_images' => $gallery,
            ]
        );

        $this->command?->info('160@Brooklyn listing created under ' . $agency->name . ' (' . count($gallery) . ' local images).');
    }
}
