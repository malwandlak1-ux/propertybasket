<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeds a single real-world-style listing (modelled on the Royal Sky
 * development in Annlin, Pretoria North, listed on plusgroupdirect.co.za)
 * under the Sandton Realty agency. Images are localised under
 * public/images/royal-sky/. Idempotent via slug.
 */
class RoyalSkyListingSeeder extends Seeder
{
    /** All gallery images, localised under public/images/royal-sky/. */
    private const IMAGE_FILES = [
        'royalsky-4552.jpg',        'royalsky-4553.jpg',        'royalsky-4554.jpg',        'royalsky-4555.jpg',        'royalsky-4556.jpg',
        'royalsky-4557.jpg',        'royalsky-4558.jpg',        'royalsky-4559.jpg',        'royalsky-4560.jpg',        'royalsky-4561.jpg',
        'royalsky-4562.jpg',        'royalsky-4563.jpg',        'royalsky-4565.jpg',        'royalsky-4566.jpg',        'royalsky-4567.jpg',
        'royalsky-4568.jpg',        'royalsky-4569.jpg',        'royalsky-4570.jpg',        'royalsky-4571.jpg',        'royalsky-4572.jpg',
        'royalsky-4573.jpg',        'royalsky-4574.jpg',        'royalsky-4575.jpg',        'royalsky-4576.jpg',        'royalsky-4577.jpg',
        'royalsky-4578.jpg',
    ];

    public function run(): void
    {
        // Prod: target a specific agency by its owner's email via env var
        //   ROYALSKY_OWNER_EMAIL=info@propertybasket.co.za php artisan db:seed --class=RoyalSkyListingSeeder --force
        // Local: default to the Sandton Realty demo agency with Sipho as the agent.
        $ownerEmail = getenv('ROYALSKY_OWNER_EMAIL') ?: null;

        if ($ownerEmail) {
            $owner = User::where('email', $ownerEmail)->first();
            if (! $owner) {
                $this->command?->error("No user found for ROYALSKY_OWNER_EMAIL={$ownerEmail}.");
                return;
            }
            $agency  = Agency::where('user_id', $owner->id)->first();
            $agentId = $owner->id;
        } else {
            $agency  = Agency::where('slug', 'sandton-realty')->first();
            $agentId = User::where('email', 'sipho@sandton-realty.test')->value('id');
        }

        if (! $agency) {
            $this->command?->error('Target agency not found — check ROYALSKY_OWNER_EMAIL, or run DemoDataSeeder locally.');
            return;
        }

        $gallery = array_map(fn (string $f) => '/images/royal-sky/' . $f, self::IMAGE_FILES);

        $description = <<<TXT
Royal Sky is a 24-hour secured estate in Annlin, Pretoria North, offering modern high-end full-title freestanding homes with the finest features, finishes and modern comforts. Conveniently located close to excellent schools, shopping centres with great retail options and hospitals, it's the place to elevate your lifestyle.

A range of 3-bedroom, 2-bathroom homes with double garages is available, from 138 m² to 170 m², priced from R2,049,000 to R2,499,000.

Every home is full-title and freestanding, with a private garden and built-in braai, and is fibre-ready and pet-friendly. Homes include a solar geyser and prepaid electricity, all within a secure estate with 24-hour security in an excellent Pretoria North location.
TXT;

        Listing::updateOrCreate(
            ['slug' => 'royal-sky-annlin'],
            [
                'ulid'          => (string) Str::ulid(),
                'owner_type'    => Agency::class,
                'owner_id'      => $agency->id,
                'agent_id'      => $agentId,

                'title'         => 'Royal Sky – 3 Bed Freestanding Homes in Annlin, Pretoria North',
                'description'   => $description,

                'listing_type'  => 'for_sale',
                'property_type' => 'house',
                'status'        => 'available',

                'sale_price'    => 2_049_000,

                'address'       => 'Royal Sky Estate, Annlin',
                'suburb'        => 'Annlin',
                'city'          => 'Pretoria',
                'province'      => 'Gauteng',
                'postal_code'   => '0182',
                'latitude'      => -25.6660,
                'longitude'     => 28.1930,

                'bedrooms'      => 3,
                'bathrooms'     => 2,
                'area_sqm'      => 138,

                'amenities' => [
                    'Security'         => ['24-hour security', 'Secure estate'],
                    'Interior'         => ['Fibre-ready', 'Prepaid electricity', 'High-end finishes'],
                    'Exterior'         => ['Full-title freestanding homes', 'Private garden', 'Built-in braai', 'Double garage'],
                    'Sustainability'   => ['Solar geyser'],
                    'Estate lifestyle' => ['Pet friendly', 'Excellent location'],
                ],

                'primary_image'  => '/images/royal-sky/royalsky-4552.jpg',
                'gallery_images' => $gallery,
            ]
        );

        $this->command?->info('Royal Sky listing created under ' . $agency->name . ' (' . count($gallery) . ' local images).');
    }
}
