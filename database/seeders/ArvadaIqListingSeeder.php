<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeds a single real-world-style listing (modelled on the Arvada iQ
 * development by UNiQON in Six Fountains estate, Pretoria, listed on
 * plusgroupdirect.co.za) under the Sandton Realty agency. Images are
 * localised under public/images/arvada-iq/. Idempotent via slug.
 */
class ArvadaIqListingSeeder extends Seeder
{
    /** All gallery images, localised under public/images/arvada-iq/. */
    private const IMAGE_FILES = [
        'arvada-2304.jpg',        'arvada-2305.jpg',        'arvada-2306.jpg',        'arvada-2307.jpg',        'arvada-2308.jpg',
        'arvada-2309.jpg',        'arvada-2310.jpg',        'arvada-2311.jpg',        'arvada-2312.jpg',        'arvada-2313.jpg',
        'arvada-2314.jpg',        'arvada-2315.jpg',        'arvada-2316.jpg',        'arvada-2317.jpg',        'arvada-2318.jpg',
        'arvada-2319.jpg',        'arvada-2320.jpg',        'arvada-2321.jpg',        'arvada-2322.jpg',        'arvada-2323.jpg',
        'arvada-2324.jpg',        'arvada-2325.jpg',        'arvada-2326.jpg',        'arvada-2327.jpg',        'arvada-2328.jpg',
        'arvada-2329.jpg',        'arvada-2330.jpg',        'arvada-2331.jpg',        'arvada-2332.jpg',        'arvada-2333.jpg',
        'arvada-2334.jpg',        'arvada-2335.jpg',        'arvada-2336.jpg',        'arvada-2337.jpg',        'arvada-2338.jpg',
        'arvada-2339.jpg',        'arvada-2340.jpg',        'arvada-2341.jpg',        'arvada-2342.jpg',        'arvada-2343.jpg',
        'arvada-2344.jpg',        'arvada-2345.jpg',        'arvada-2346.jpg',        'arvada-2347.jpg',        'arvada-2348.jpg',
        'arvada-2349.jpg',        'arvada-2350.jpg',        'arvada-2351.jpg',        'arvada-2352.jpg',        'arvada-2353.jpg',
        'arvada-2354.jpg',        'arvada-2355.jpg',        'arvada-2356.jpg',        'arvada-2357.jpg',        'arvada-2358.jpg',
        'arvada-2359.jpg',        'arvada-2360.jpg',
    ];

    public function run(): void
    {
        // Prod: target a specific agency by its owner's email via env var
        //   ARVADA_OWNER_EMAIL=info@propertybasket.co.za php artisan db:seed --class=ArvadaIqListingSeeder --force
        // Local: default to the Sandton Realty demo agency with Sipho as the agent.
        $ownerEmail = getenv('ARVADA_OWNER_EMAIL') ?: null;

        if ($ownerEmail) {
            $owner = User::where('email', $ownerEmail)->first();
            if (! $owner) {
                $this->command?->error("No user found for ARVADA_OWNER_EMAIL={$ownerEmail}.");
                return;
            }
            $agency  = Agency::where('user_id', $owner->id)->first();
            $agentId = $owner->id;
        } else {
            $agency  = Agency::where('slug', 'sandton-realty')->first();
            $agentId = User::where('email', 'sipho@sandton-realty.test')->value('id');
        }

        if (! $agency) {
            $this->command?->error('Target agency not found — check ARVADA_OWNER_EMAIL, or run DemoDataSeeder locally.');
            return;
        }

        $gallery = array_map(fn (string $f) => '/images/arvada-iq/' . $f, self::IMAGE_FILES);

        $description = <<<TXT
Arvada iQ is a development by UNiQON designed with the "remote work" principle in mind, providing a peaceful space everyone will love spending time in. Located in the beautiful and tranquil Six Fountains estate on the outskirts of Pretoria, it offers spacious rooms and remarkable finishes, with a private patio, braai, garden, gas, solar and an inverter. All costs are included.

Two unit types are available:
• Type A — 3 bedrooms, 2 bathrooms plus a guest bathroom, 234 m², from R2,360,000
• Type B — 2 bedrooms, 2 bathrooms, 147 m², from R1,750,000

Every home features a 5 kW solar panel and inverter (PV) system, a solar geyser, a gas hob with electric oven, a garden, private patio and braai, a garage plus carport, a guest bathroom, and is fibre-ready with prepaid electricity.

The estate offers a nature area with walkways, catch-and-release fishing and a picnic area, all behind 24-hour security with CCTV and a spike boom gate. It sits minutes from the Six Fountains Lifestyle Centre, Hazeldean Square, top schools and Intercare Silver Lakes. A combined household income of approximately R58,500 per month is recommended for bond approval. Development by UNiQON.
TXT;

        Listing::updateOrCreate(
            ['slug' => 'arvada-iq-six-fountains'],
            [
                'ulid'          => (string) Str::ulid(),
                'owner_type'    => Agency::class,
                'owner_id'      => $agency->id,
                'agent_id'      => $agentId,

                'title'         => 'Arvada iQ – 3 Bed Home in Six Fountains Estate, Pretoria',
                'description'   => $description,

                'listing_type'  => 'for_sale',
                'property_type' => 'townhouse',
                'status'        => 'available',

                'sale_price'    => 2_360_000,

                'address'       => 'Arvada iQ, Six Fountains Estate',
                'suburb'        => 'Six Fountains',
                'city'          => 'Pretoria',
                'province'      => 'Gauteng',
                'postal_code'   => '0081',
                'latitude'      => -25.7830,
                'longitude'     => 28.3480,

                'bedrooms'      => 3,
                'bathrooms'     => 2,
                'area_sqm'      => 234,

                'amenities' => [
                    'Security'         => ['24-hour security', 'CCTV', 'Spike boom gate', 'All costs included'],
                    'Interior'         => ['Gas hob', 'Electric oven', 'Guest bathroom', 'Fibre-ready', 'Prepaid electricity'],
                    'Exterior'         => ['Garden', 'Private patio', 'Braai', 'Garage + carport'],
                    'Sustainability'   => ['5 kW solar panels + inverter (PV)', 'Solar geyser'],
                    'Estate lifestyle' => ['Nature area with walkways', 'Catch-and-release fishing', 'Picnic area'],
                ],

                'primary_image'  => '/images/arvada-iq/arvada-2304.jpg',
                'gallery_images' => $gallery,
            ]
        );

        $this->command?->info('Arvada iQ listing created under ' . $agency->name . ' (' . count($gallery) . ' local images).');
    }
}
