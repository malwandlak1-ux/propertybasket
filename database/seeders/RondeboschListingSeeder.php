<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeds a single real-world-style listing (modelled on the Rondebosch
 * development by UNiQON in Rietvalleirand, Pretoria, listed on
 * plusgroupdirect.co.za) under the Sandton Realty agency. Images are
 * localised under public/images/rondebosch/. Idempotent via slug.
 */
class RondeboschListingSeeder extends Seeder
{
    /** All gallery images, localised under public/images/rondebosch/. */
    private const IMAGE_FILES = [
        'rondebosch-2520.jpg',        'rondebosch-2521.jpg',        'rondebosch-2522.jpg',        'rondebosch-2523.jpg',        'rondebosch-2524.jpg',
        'rondebosch-2525.jpg',        'rondebosch-2526.jpg',        'rondebosch-2527.jpg',        'rondebosch-2528.jpg',        'rondebosch-2529.jpg',
        'rondebosch-2530.jpg',        'rondebosch-2531.jpg',        'rondebosch-2532.jpg',        'rondebosch-2533.jpg',        'rondebosch-2534.jpg',
        'rondebosch-2535.jpg',        'rondebosch-2536.jpg',        'rondebosch-2537.jpg',        'rondebosch-2538.jpg',        'rondebosch-2539.jpg',
    ];

    public function run(): void
    {
        // Prod: target a specific agency by its owner's email via env var
        //   RONDEBOSCH_OWNER_EMAIL=info@propertybasket.co.za php artisan db:seed --class=RondeboschListingSeeder --force
        // Local: default to the Sandton Realty demo agency with Sipho as the agent.
        $ownerEmail = getenv('RONDEBOSCH_OWNER_EMAIL') ?: null;

        if ($ownerEmail) {
            $owner = User::where('email', $ownerEmail)->first();
            if (! $owner) {
                $this->command?->error("No user found for RONDEBOSCH_OWNER_EMAIL={$ownerEmail}.");
                return;
            }
            $agency  = Agency::where('user_id', $owner->id)->first();
            $agentId = $owner->id;
        } else {
            $agency  = Agency::where('slug', 'sandton-realty')->first();
            $agentId = User::where('email', 'sipho@sandton-realty.test')->value('id');
        }

        if (! $agency) {
            $this->command?->error('Target agency not found — check RONDEBOSCH_OWNER_EMAIL, or run DemoDataSeeder locally.');
            return;
        }

        $gallery = array_map(fn (string $f) => '/images/rondebosch/' . $f, self::IMAGE_FILES);

        $description = <<<TXT
Rondebosch is a modern high-end development by UNiQON, perfectly situated in Rietvalleirand, Pretoria — opposite the R21 highway and close to Castle Gate and Castle Walk. Each home features stylish finishes and clean lines fit for royalty.

Two unit types are available, both 2 bedrooms, 2 bathrooms with double garages across 87 m²:
• Type A — from R1,395,000
• Type B — from R2,450,000

Every home includes a gas stove, a solar geyser, a private garden, a private patio and a built-in braai, and is fibre-ready and pet-friendly with prepaid electricity. The estate offers 24-hour security. A combined household income of approximately R35,000 per month is recommended for bond approval. Development by UNiQON.
TXT;

        Listing::updateOrCreate(
            ['slug' => 'rondebosch-rietvalleirand'],
            [
                'ulid'          => (string) Str::ulid(),
                'owner_type'    => Agency::class,
                'owner_id'      => $agency->id,
                'agent_id'      => $agentId,

                'title'         => 'Rondebosch – 2 Bed Home in Rietvalleirand, Pretoria',
                'description'   => $description,

                'listing_type'  => 'for_sale',
                'property_type' => 'townhouse',
                'status'        => 'available',

                'sale_price'    => 1_395_000,

                'address'       => 'Rondebosch, Rietvalleirand',
                'suburb'        => 'Rietvalleirand',
                'city'          => 'Pretoria',
                'province'      => 'Gauteng',
                'postal_code'   => '0181',
                'latitude'      => -25.8330,
                'longitude'     => 28.2830,

                'bedrooms'      => 2,
                'bathrooms'     => 2,
                'area_sqm'      => 87,

                'amenities' => [
                    'Security'       => ['24-hour security'],
                    'Interior'       => ['Gas stove', 'Fibre-ready', 'Prepaid electricity', 'Stylish finishes'],
                    'Exterior'       => ['Private garden', 'Private patio', 'Built-in braai', 'Double garage'],
                    'Sustainability' => ['Solar geyser'],
                    'Lifestyle'      => ['Pet-friendly'],
                ],

                'primary_image'  => '/images/rondebosch/rondebosch-2520.jpg',
                'gallery_images' => $gallery,
            ]
        );

        $this->command?->info('Rondebosch listing created under ' . $agency->name . ' (' . count($gallery) . ' local images).');
    }
}
