<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeds a single real-world-style listing (modelled on the Etude
 * development by AFHCO in Sagewood, Midrand, listed on
 * plusgroupdirect.co.za) under the Sandton Realty agency. Images are
 * localised under public/images/etude/. Idempotent via slug.
 */
class EtudeListingSeeder extends Seeder
{
    /** All gallery images, localised under public/images/etude/. */
    private const IMAGE_FILES = [
        'etude-7136.jpg', 'etude-7137.jpg', 'etude-7138.jpg', 'etude-7139.jpg', 'etude-7140.jpg',
        'etude-7141.jpg', 'etude-7142.jpg', 'etude-7143.jpg', 'etude-7144.jpg', 'etude-7145.jpg',
        'etude-7146.jpg', 'etude-7147.jpg', 'etude-7148.jpg', 'etude-7149.jpg', 'etude-7150.jpg',
        'etude-7151.jpg', 'etude-7152.jpg', 'etude-7153.jpg', 'etude-7154.jpg', 'etude-7155.jpg',
        'etude-7156.jpg', 'etude-7157.jpg', 'etude-7158.jpg', 'etude-7159.jpg', 'etude-7160.jpg',
        'etude-7161.jpg', 'etude-7162.jpg',
    ];

    public function run(): void
    {
        // Prod: target a specific agency by its owner's email via env var
        //   ETUDE_OWNER_EMAIL=info@propertybasket.co.za php artisan db:seed --class=EtudeListingSeeder --force
        // Local: default to the Sandton Realty demo agency with Sipho as the agent.
        $ownerEmail = getenv('ETUDE_OWNER_EMAIL') ?: null;

        if ($ownerEmail) {
            $owner = User::where('email', $ownerEmail)->first();
            if (! $owner) {
                $this->command?->error("No user found for ETUDE_OWNER_EMAIL={$ownerEmail}.");
                return;
            }
            $agency  = Agency::where('user_id', $owner->id)->first();
            $agentId = $owner->id;
        } else {
            $agency  = Agency::where('slug', 'sandton-realty')->first();
            $agentId = User::where('email', 'sipho@sandton-realty.test')->value('id');
        }

        if (! $agency) {
            $this->command?->error('Target agency not found — check ETUDE_OWNER_EMAIL, or run DemoDataSeeder locally.');
            return;
        }

        $gallery = array_map(fn (string $f) => '/images/etude/' . $f, self::IMAGE_FILES);

        $description = <<<TXT
Etude is a modern residential development by AFHCO in Sagewood, Midrand, placed perfectly between Johannesburg and Pretoria for seamless access to work, play and everything in between. With stylish finishes, smart lifestyle features and secure living at its core, this is where everyday convenience meets contemporary comfort.

Standard units are 60 m² and feature 2 bedrooms and 1 bathroom, priced from R745,000. Interiors include granite kitchen counters, built-in cupboards and a full stove.

The development offers 24-hour security with controlled access, a communal pool, landscaped spaces and private gardens. It is minutes from Gautrain bus stops, filling stations, shopping centres, schools and Grand Central Airport. A combined household income of approximately R24,377 per month is recommended for bond approval. Development by AFHCO.
TXT;

        Listing::updateOrCreate(
            ['slug' => 'etude-sagewood-midrand'],
            [
                'ulid'          => (string) Str::ulid(),
                'owner_type'    => Agency::class,
                'owner_id'      => $agency->id,
                'agent_id'      => $agentId,

                'title'         => 'Etude – 2 Bed Apartments from R745,000 in Sagewood, Midrand',
                'description'   => $description,

                'listing_type'  => 'for_sale',
                'property_type' => 'apartment',
                'status'        => 'available',

                'sale_price'    => 745_000,

                'address'       => 'Etude, Sagewood',
                'suburb'        => 'Sagewood',
                'city'          => 'Midrand',
                'province'      => 'Gauteng',
                'postal_code'   => '1685',
                'latitude'      => -25.9720,
                'longitude'     => 28.1180,

                'bedrooms'      => 2,
                'bathrooms'     => 1,
                'area_sqm'      => 60,

                'amenities' => [
                    'Security'         => ['24-hour security', 'Controlled access'],
                    'Interior'         => ['Granite kitchen counters', 'Built-in cupboards', 'Full stove'],
                    'Exterior'         => ['Private gardens'],
                    'Estate lifestyle' => ['Communal pool', 'Landscaped spaces'],
                ],

                'primary_image'  => '/images/etude/etude-7136.jpg',
                'gallery_images' => $gallery,
            ]
        );

        $this->command?->info('Etude listing created under ' . $agency->name . ' (' . count($gallery) . ' local images).');
    }
}
