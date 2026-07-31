<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeds a single real-world-style listing (modelled on the Rheenendal Living
 * development by UNiQON in Rietvalleirand, Pretoria, listed on
 * plusgroupdirect.co.za) under the Sandton Realty agency. Images are
 * localised under public/images/rheenendal/. Idempotent via slug.
 */
class RheenendalLivingListingSeeder extends Seeder
{
    /** All gallery images, localised under public/images/rheenendal/. */
    private const IMAGE_FILES = [
        'rheenendal-6051.jpg',        'rheenendal-6052.jpg',        'rheenendal-6053.jpg',        'rheenendal-6054.jpg',        'rheenendal-6055.jpg',
        'rheenendal-6056.jpg',        'rheenendal-6057.jpg',        'rheenendal-6058.jpg',        'rheenendal-6059.jpg',        'rheenendal-6060.jpg',
        'rheenendal-6061.jpg',        'rheenendal-6062.jpg',        'rheenendal-6063.jpg',        'rheenendal-6064.jpg',        'rheenendal-6065.jpg',
        'rheenendal-6066.jpg',        'rheenendal-6067.jpg',        'rheenendal-6068.jpg',        'rheenendal-6069.jpg',        'rheenendal-6070.jpg',
        'rheenendal-6071.jpg',        'rheenendal-6072.jpg',        'rheenendal-6073.jpg',        'rheenendal-6074.jpg',        'rheenendal-6075.jpg',
        'rheenendal-6076.jpg',        'rheenendal-6077.jpg',        'rheenendal-6078.jpg',        'rheenendal-6079.jpg',        'rheenendal-6080.jpg',
        'rheenendal-6081.jpg',        'rheenendal-6082.jpg',        'rheenendal-6083.jpg',        'rheenendal-6084.jpg',        'rheenendal-6085.jpg',
        'rheenendal-6086.jpg',        'rheenendal-6087.jpg',        'rheenendal-6088.jpg',        'rheenendal-6089.jpg',        'rheenendal-6090.jpg',
        'rheenendal-6091.jpg',        'rheenendal-6092.jpg',        'rheenendal-6093.jpg',        'rheenendal-6094.jpg',        'rheenendal-6095.jpg',
        'rheenendal-6096.jpg',        'rheenendal-6097.jpg',        'rheenendal-6098.jpg',        'rheenendal-6099.jpg',        'rheenendal-6100.jpg',
        'rheenendal-6101.jpg',        'rheenendal-6102.jpg',        'rheenendal-6120.jpg',        'rheenendal-6122.jpg',        'rheenendal-6123.jpg',
        'rheenendal-6124.jpg',        'rheenendal-6125.jpg',        'rheenendal-6126.jpg',        'rheenendal-6127.jpg',        'rheenendal-6128.jpg',
        'rheenendal-6129.jpg',        'rheenendal-6131.jpg',        'rheenendal-6132.jpg',        'rheenendal-6133.jpg',        'rheenendal-6134.jpg',
        'rheenendal-6135.jpg',
    ];

    public function run(): void
    {
        // Prod: target a specific agency by its owner's email via env var
        //   RHEENENDAL_OWNER_EMAIL=info@propertybasket.co.za php artisan db:seed --class=RheenendalLivingListingSeeder --force
        // Local: default to the Sandton Realty demo agency with Sipho as the agent.
        $ownerEmail = getenv('RHEENENDAL_OWNER_EMAIL') ?: null;

        if ($ownerEmail) {
            $owner = User::where('email', $ownerEmail)->first();
            if (! $owner) {
                $this->command?->error("No user found for RHEENENDAL_OWNER_EMAIL={$ownerEmail}.");
                return;
            }
            $agency  = Agency::where('user_id', $owner->id)->first();
            $agentId = $owner->id;
        } else {
            $agency  = Agency::where('slug', 'sandton-realty')->first();
            $agentId = User::where('email', 'sipho@sandton-realty.test')->value('id');
        }

        if (! $agency) {
            $this->command?->error('Target agency not found — check RHEENENDAL_OWNER_EMAIL, or run DemoDataSeeder locally.');
            return;
        }

        $gallery = array_map(fn (string $f) => '/images/rheenendal/' . $f, self::IMAGE_FILES);

        $description = <<<TXT
Rheenendal Living is an exclusive new development by UNiQON in Rietvalleirand, one of Pretoria's most sought-after suburbs, where convenience meets comfort. These stylish homes are designed for modern living, perfectly located and packed with premium features — and all costs are included for your peace of mind.

Two unit types are available:
• Stacked units — 2 bedrooms, 2 bathrooms, 131 m², from R1,675,000
• Simplex homes — 3 bedrooms, 2 bathrooms, 160 m², from R2,600,000

Every home features a gas hob, granite countertops, built-in cupboards, a built-in braai and prepaid electricity, with private gardens on the simplexes. Built for resilience, homes include a solar geyser, solar backup power and a backup water system.

The pet-friendly estate offers 24-hour security and communal green spaces, and sits minutes from filling stations, the Vallei Forum and Winmore Village shopping centres, schools and medical facilities. A combined household income of approximately R60,507 per month is recommended for bond approval. Development by UNiQON.
TXT;

        Listing::updateOrCreate(
            ['slug' => 'rheenendal-living-rietvalleirand'],
            [
                'ulid'          => (string) Str::ulid(),
                'owner_type'    => Agency::class,
                'owner_id'      => $agency->id,
                'agent_id'      => $agentId,

                'title'         => 'Rheenendal Living – 3 Bed Simplex in Rietvalleirand, Pretoria',
                'description'   => $description,

                'listing_type'  => 'for_sale',
                'property_type' => 'townhouse',
                'status'        => 'available',

                'sale_price'    => 2_600_000,

                'address'       => 'Rheenendal Living, Rietvalleirand',
                'suburb'        => 'Rietvalleirand',
                'city'          => 'Pretoria',
                'province'      => 'Gauteng',
                'postal_code'   => '0181',
                'latitude'      => -25.8330,
                'longitude'     => 28.2830,

                'bedrooms'      => 3,
                'bathrooms'     => 2,
                'area_sqm'      => 160,

                'amenities' => [
                    'Security'         => ['24-hour security', 'All costs included'],
                    'Interior'         => ['Gas hob', 'Granite countertops', 'Built-in cupboards', 'Prepaid electricity'],
                    'Exterior'         => ['Private garden (simplexes)', 'Built-in braai'],
                    'Sustainability'   => ['Solar geyser', 'Solar backup power', 'Backup water system'],
                    'Estate lifestyle' => ['Pet friendly', 'Communal green spaces'],
                ],

                'primary_image'  => '/images/rheenendal/rheenendal-6051.jpg',
                'gallery_images' => $gallery,
            ]
        );

        $this->command?->info('Rheenendal Living listing created under ' . $agency->name . ' (' . count($gallery) . ' local images).');
    }
}
