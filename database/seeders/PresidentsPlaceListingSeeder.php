<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeds a single real-world-style listing (modelled on the Presidents Place
 * development by JFS in President Park AH, Midrand, listed on
 * plusgroupdirect.co.za) under the Sandton Realty agency. Images are
 * localised under public/images/presidents-place/. Idempotent via slug.
 */
class PresidentsPlaceListingSeeder extends Seeder
{
    /** All gallery images, localised under public/images/presidents-place/. */
    private const IMAGE_FILES = [
        'presidents-4341.jpg',        'presidents-4342.jpg',        'presidents-4343.jpg',        'presidents-4344.jpg',        'presidents-4345.jpg',
        'presidents-4346.jpg',        'presidents-4347.jpg',        'presidents-4348.jpg',        'presidents-5197.jpg',        'presidents-5198.jpg',
        'presidents-5199.jpg',        'presidents-5200.jpg',        'presidents-5201.jpg',        'presidents-5202.jpg',        'presidents-5203.jpg',
        'presidents-5204.jpg',        'presidents-5205.jpg',        'presidents-5206.jpg',        'presidents-5207.jpg',        'presidents-5208.jpg',
        'presidents-5209.jpg',        'presidents-5210.jpg',        'presidents-5211.jpg',        'presidents-5212.jpg',
    ];

    public function run(): void
    {
        // Prod: target a specific agency by its owner's email via env var
        //   PRESIDENTS_OWNER_EMAIL=info@propertybasket.co.za php artisan db:seed --class=PresidentsPlaceListingSeeder --force
        // Local: default to the Sandton Realty demo agency with Sipho as the agent.
        $ownerEmail = getenv('PRESIDENTS_OWNER_EMAIL') ?: null;

        if ($ownerEmail) {
            $owner = User::where('email', $ownerEmail)->first();
            if (! $owner) {
                $this->command?->error("No user found for PRESIDENTS_OWNER_EMAIL={$ownerEmail}.");
                return;
            }
            $agency  = Agency::where('user_id', $owner->id)->first();
            $agentId = $owner->id;
        } else {
            $agency  = Agency::where('slug', 'sandton-realty')->first();
            $agentId = User::where('email', 'sipho@sandton-realty.test')->value('id');
        }

        if (! $agency) {
            $this->command?->error('Target agency not found — check PRESIDENTS_OWNER_EMAIL, or run DemoDataSeeder locally.');
            return;
        }

        $gallery = array_map(fn (string $f) => '/images/presidents-place/' . $f, self::IMAGE_FILES);

        $description = <<<TXT
Presidents Place is a full-title development by JFS in President Park AH, Midrand, where you choose from a selection of building packages to suit your needs and budget. Come home to a modern, practically built house with quality fittings and finishes — your haven where you'll nurture memories to share for a lifetime. All costs are included.

A range of 3-bedroom, 2-bathroom free-standing homes with double garages is available across single or double storeys, from 65 m² to 153 m², priced from R1,350,000 to R2,037,000 (rental options from around R9,060/month):
• Type 1 — 65 m², from R1,350,000
• Type 2 — 70 m², from R1,389,000
• Type 3 — 87 m², from R1,546,000
• Type 4 — 103 m², from R1,608,000
• Type 5 — 115 m², from R1,719,000
• Type 6 — 153 m², up to R2,037,000

Every home is full-title on a large stand, with a gas hob stove, a private garden, a double garage or paved carport, a main-bedroom ensuite, built-in cupboards and modern fittings and finishes. Homes are solar-ready (60 Amp installation with meter and distribution board; wiring allows for adding a battery, inverter and PV panel system), with aluminium top-hung windows, burglar bars, security gates on external doors and Tuscan roofs with gable (double storey). A combined household income of approximately R48,766 per month is recommended for bond approval. Development by JFS.
TXT;

        Listing::updateOrCreate(
            ['slug' => 'presidents-place-president-park'],
            [
                'ulid'          => (string) Str::ulid(),
                'owner_type'    => Agency::class,
                'owner_id'      => $agency->id,
                'agent_id'      => $agentId,

                'title'         => 'Presidents Place – Full-Title 3 Bed Homes from R1,350,000 in Midrand',
                'description'   => $description,

                'listing_type'  => 'for_sale',
                'property_type' => 'house',
                'status'        => 'available',

                'sale_price'    => 1_350_000,

                'address'       => 'Presidents Place, President Park AH',
                'suburb'        => 'President Park',
                'city'          => 'Midrand',
                'province'      => 'Gauteng',
                'postal_code'   => '1685',
                'latitude'      => -25.9670,
                'longitude'     => 28.1560,

                'bedrooms'      => 3,
                'bathrooms'     => 2,
                'area_sqm'      => 65,

                'amenities' => [
                    'Security'       => ['Burglar bars across all openings', 'Security gates to external doors', 'All costs included'],
                    'Interior'       => ['Gas hob stove', 'Main bedroom ensuite', 'Built-in cupboards', 'Modern fittings and finishes', 'Aluminium top-hung windows'],
                    'Exterior'       => ['Full-title free-standing homes', 'Large stands', 'Private garden', 'Double garage or paved carport', 'Single or double storey'],
                    'Sustainability' => ['Solar-ready: 60 Amp installation', 'Wiring for battery, inverter & PV panels'],
                ],

                'primary_image'  => '/images/presidents-place/presidents-4341.jpg',
                'gallery_images' => $gallery,
            ]
        );

        $this->command?->info('Presidents Place listing created under ' . $agency->name . ' (' . count($gallery) . ' local images).');
    }
}
