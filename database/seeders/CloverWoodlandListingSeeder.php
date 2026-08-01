<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeds a single real-world-style listing (modelled on the Clover Woodland
 * development in Rynfield AH, Benoni, listed on plusgroupdirect.co.za)
 * under the Sandton Realty agency. Images are localised under
 * public/images/clover-woodland/. Idempotent via slug.
 */
class CloverWoodlandListingSeeder extends Seeder
{
    /** All gallery images, localised under public/images/clover-woodland/. */
    private const IMAGE_FILES = [
        'clover-5624.jpg',        'clover-5625.jpg',        'clover-5626.jpg',        'clover-5627.jpg',        'clover-5628.jpg',
        'clover-5629.jpg',        'clover-5630.jpg',        'clover-5631.jpg',        'clover-5632.jpg',        'clover-5633.jpg',
        'clover-5634.jpg',        'clover-5635.jpg',        'clover-5636.jpg',        'clover-5637.jpg',        'clover-5638.jpg',
        'clover-5639.jpg',        'clover-5640.jpg',        'clover-5641.jpg',        'clover-5642.jpg',        'clover-5643.jpg',
        'clover-5644.jpg',        'clover-5645.jpg',        'clover-5646.jpg',        'clover-5647.jpg',        'clover-5648.jpg',
        'clover-5649.jpg',        'clover-5650.jpg',        'clover-5651.jpg',        'clover-5652.jpg',        'clover-5653.jpg',
    ];

    public function run(): void
    {
        // Prod: target a specific agency by its owner's email via env var
        //   CLOVER_OWNER_EMAIL=info@propertybasket.co.za php artisan db:seed --class=CloverWoodlandListingSeeder --force
        // Local: default to the Sandton Realty demo agency with Sipho as the agent.
        $ownerEmail = getenv('CLOVER_OWNER_EMAIL') ?: null;

        if ($ownerEmail) {
            $owner = User::where('email', $ownerEmail)->first();
            if (! $owner) {
                $this->command?->error("No user found for CLOVER_OWNER_EMAIL={$ownerEmail}.");
                return;
            }
            $agency  = Agency::where('user_id', $owner->id)->first();
            $agentId = $owner->id;
        } else {
            $agency  = Agency::where('slug', 'sandton-realty')->first();
            $agentId = User::where('email', 'sipho@sandton-realty.test')->value('id');
        }

        if (! $agency) {
            $this->command?->error('Target agency not found — check CLOVER_OWNER_EMAIL, or run DemoDataSeeder locally.');
            return;
        }

        $gallery = array_map(fn (string $f) => '/images/clover-woodland/' . $f, self::IMAGE_FILES);

        $description = <<<TXT
Clover Woodland is an exciting new development in Rynfield AH, Benoni, offering unbeatable affordability — ideal for first-time buyers and savvy investors alike. Close to schools, hospitals and shopping centres, it's a gem in Joburg East you shouldn't miss out on. All costs are included.

Two unit types are available, both 2 bedrooms and 1 bathroom:
• 60 m² — from R695,000
• 62 m² — from R790,000

These perfect lock-up-and-go homes come with low levies, rates and taxes and no holding deposits. Every unit includes built-in cupboards, prepaid electricity, a separate water meter and is fibre-ready with an NHBRC warranty; ground-floor units have a private garden. The development is pet-friendly with 24-hour security and access control. A combined household income of approximately R22,741 per month is recommended for bond approval.
TXT;

        Listing::updateOrCreate(
            ['slug' => 'clover-woodland-rynfield'],
            [
                'ulid'          => (string) Str::ulid(),
                'owner_type'    => Agency::class,
                'owner_id'      => $agency->id,
                'agent_id'      => $agentId,

                'title'         => 'Clover Woodland – 2 Bed Home from R695,000 in Rynfield, Benoni',
                'description'   => $description,

                'listing_type'  => 'for_sale',
                'property_type' => 'apartment',
                'status'        => 'available',

                'sale_price'    => 695_000,

                'address'       => 'Clover Woodland, Rynfield AH Section 1',
                'suburb'        => 'Rynfield',
                'city'          => 'Benoni',
                'province'      => 'Gauteng',
                'postal_code'   => '1514',
                'latitude'      => -26.1450,
                'longitude'     => 28.3400,

                'bedrooms'      => 2,
                'bathrooms'     => 1,
                'area_sqm'      => 60,

                'amenities' => [
                    'Security'         => ['24-hour security', 'Access control', 'All costs included'],
                    'Interior'         => ['Built-in cupboards', 'Prepaid electricity', 'Separate water meter', 'Fibre-ready', 'NHBRC warranty'],
                    'Exterior'         => ['Private garden (ground floor units)', 'Perfect lock-up and go'],
                    'Value'            => ['Low levies, rates and taxes', 'No holding deposits'],
                    'Lifestyle'        => ['Pet friendly'],
                ],

                'primary_image'  => '/images/clover-woodland/clover-5624.jpg',
                'gallery_images' => $gallery,
            ]
        );

        $this->command?->info('Clover Woodland listing created under ' . $agency->name . ' (' . count($gallery) . ' local images).');
    }
}
