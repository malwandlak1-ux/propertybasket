<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeds a single real-world-style listing (modelled on the Justice Court
 * development in Muckleneuk, Pretoria, listed on plusgroupdirect.co.za)
 * under the Sandton Realty agency. Images are localised under
 * public/images/justice-court/. Idempotent via slug.
 */
class JusticeCourtListingSeeder extends Seeder
{
    /** All gallery images, localised under public/images/justice-court/. */
    private const IMAGE_FILES = [
        'justice-5213.jpg',        'justice-5214.jpg',        'justice-5215.jpg',        'justice-5216.jpg',        'justice-5217.jpg',
        'justice-5218.jpg',        'justice-5219.jpg',        'justice-5220.jpg',        'justice-5221.jpg',        'justice-5222.jpg',
        'justice-5223.jpg',        'justice-5224.jpg',        'justice-5225.jpg',        'justice-5226.jpg',        'justice-5227.jpg',
        'justice-5228.jpg',
    ];

    public function run(): void
    {
        // Prod: target a specific agency by its owner's email via env var
        //   JUSTICE_OWNER_EMAIL=info@propertybasket.co.za php artisan db:seed --class=JusticeCourtListingSeeder --force
        // Local: default to the Sandton Realty demo agency with Sipho as the agent.
        $ownerEmail = getenv('JUSTICE_OWNER_EMAIL') ?: null;

        if ($ownerEmail) {
            $owner = User::where('email', $ownerEmail)->first();
            if (! $owner) {
                $this->command?->error("No user found for JUSTICE_OWNER_EMAIL={$ownerEmail}.");
                return;
            }
            $agency  = Agency::where('user_id', $owner->id)->first();
            $agentId = $owner->id;
        } else {
            $agency  = Agency::where('slug', 'sandton-realty')->first();
            $agentId = User::where('email', 'sipho@sandton-realty.test')->value('id');
        }

        if (! $agency) {
            $this->command?->error('Target agency not found — check JUSTICE_OWNER_EMAIL, or run DemoDataSeeder locally.');
            return;
        }

        $gallery = array_map(fn (string $f) => '/images/justice-court/' . $f, self::IMAGE_FILES);

        $description = <<<TXT
Justice Court is a modern, solar-powered development in Muckleneuk, Pretoria, offering secure, energy-independent 3-storey homes with a functional layout and modern fittings and finishes. All costs are included, and there's no more load shedding — every home runs on a 5 kW Sunsynk hybrid inverter with 4 x 455 W solar panels and a 5.12 kWh lithium-ion battery, plus a 150 L solar geyser.

Two unit types are available, both priced from R2,550,000:
• Type A — 2 bedrooms, 2 bathrooms, 109 m²
• Type B — 2 bedrooms, 2 bathrooms, 112 m²

Each home features ensuite bedrooms, a private study and courtyard, a separate scullery and a children's play area, all behind 24-hour security with CCTV and access control. Superbly located, it is close to the University of Pretoria and UNISA campuses, top schools, Brooklyn shopping centre, hospitals and the Gautrain. A combined household income of approximately R90,308 per month is recommended for bond approval.
TXT;

        Listing::updateOrCreate(
            ['slug' => 'justice-court-muckleneuk'],
            [
                'ulid'          => (string) Str::ulid(),
                'owner_type'    => Agency::class,
                'owner_id'      => $agency->id,
                'agent_id'      => $agentId,

                'title'         => 'Justice Court – 2 Bed Solar Home in Muckleneuk, Pretoria',
                'description'   => $description,

                'listing_type'  => 'for_sale',
                'property_type' => 'townhouse',
                'status'        => 'available',

                'sale_price'    => 2_550_000,

                'address'       => 'Justice Court, Muckleneuk',
                'suburb'        => 'Muckleneuk',
                'city'          => 'Pretoria',
                'province'      => 'Gauteng',
                'postal_code'   => '0002',
                'latitude'      => -25.7660,
                'longitude'     => 28.2100,

                'bedrooms'      => 2,
                'bathrooms'     => 2,
                'area_sqm'      => 109,

                'amenities' => [
                    'Security'       => ['24-hour security', 'CCTV', 'Access control'],
                    'Interior'       => ['Ensuite bedrooms', 'Private study', 'Separate scullery', 'Modern fittings & finishes', '3-storey homes'],
                    'Exterior'       => ['Private courtyard', "Children's play area"],
                    'Sustainability' => ['5 kW Sunsynk hybrid inverter', '4 x 455 W solar panels', '5.12 kWh lithium-ion battery', '150 L solar geyser', 'All costs included'],
                    'Location'       => ['Close to UP & UNISA campuses', 'Close to top schools', 'Close to Brooklyn shopping centre', 'Close to hospitals'],
                ],

                'primary_image'  => '/images/justice-court/justice-5213.jpg',
                'gallery_images' => $gallery,
            ]
        );

        $this->command?->info('Justice Court listing created under ' . $agency->name . ' (' . count($gallery) . ' local images).');
    }
}
