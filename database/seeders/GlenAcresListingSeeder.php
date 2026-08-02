<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeds a single real-world-style listing (modelled on the Glen Acres Park
 * Estate development by G5 Properties in Midrand, listed on
 * plusgroupdirect.co.za) under the Sandton Realty agency. Images are
 * localised under public/images/glen-acres/. Idempotent via slug.
 */
class GlenAcresListingSeeder extends Seeder
{
    /** All gallery images, localised under public/images/glen-acres/. */
    private const IMAGE_FILES = [
        'glenacres-4149.jpg', 'glenacres-4150.jpg', 'glenacres-4151.jpg', 'glenacres-4152.jpg', 'glenacres-4153.jpg',
        'glenacres-4154.jpg', 'glenacres-4155.jpg', 'glenacres-4156.jpg', 'glenacres-4157.jpg', 'glenacres-4158.jpg',
        'glenacres-4159.jpg', 'glenacres-4160.jpg', 'glenacres-4161.jpg', 'glenacres-4162.jpg', 'glenacres-4163.jpg',
        'glenacres-4164.jpg', 'glenacres-4165.jpg', 'glenacres-4166.jpg', 'glenacres-4167.jpg', 'glenacres-4168.jpg',
        'glenacres-4173.jpg', 'glenacres-4174.jpg', 'glenacres-4175.jpg', 'glenacres-4176.jpg', 'glenacres-4177.jpg',
        'glenacres-4178.jpg', 'glenacres-4179.jpg', 'glenacres-4180.jpg', 'glenacres-4181.jpg', 'glenacres-4182.jpg',
        'glenacres-4183.jpg', 'glenacres-4184.jpg', 'glenacres-4185.jpg', 'glenacres-4186.jpg', 'glenacres-4187.jpg',
        'glenacres-4188.jpg', 'glenacres-4189.jpg', 'glenacres-4206.jpg', 'glenacres-4207.jpg', 'glenacres-4208.jpg',
        'glenacres-4209.jpg', 'glenacres-4210.jpg', 'glenacres-4211.jpg', 'glenacres-4212.jpg', 'glenacres-4213.jpg',
        'glenacres-4214.jpg', 'glenacres-4215.jpg', 'glenacres-4216.jpg', 'glenacres-4217.jpg', 'glenacres-4218.jpg',
        'glenacres-4219.jpg', 'glenacres-4220.jpg', 'glenacres-4221.jpg', 'glenacres-4222.jpg', 'glenacres-4223.jpg',
        'glenacres-4224.jpg', 'glenacres-4225.jpg', 'glenacres-4226.jpg', 'glenacres-4227.jpg', 'glenacres-4228.jpg',
        'glenacres-4229.jpg', 'glenacres-4230.jpg', 'glenacres-4231.jpg', 'glenacres-4232.jpg', 'glenacres-4233.jpg',
        'glenacres-4234.jpg', 'glenacres-4235.jpg', 'glenacres-4236.jpg', 'glenacres-4237.jpg', 'glenacres-4238.jpg',
        'glenacres-4239.jpg', 'glenacres-4240.jpg', 'glenacres-4241.jpg', 'glenacres-4242.jpg', 'glenacres-4243.jpg',
        'glenacres-4244.jpg', 'glenacres-4245.jpg', 'glenacres-4246.jpg', 'glenacres-4247.jpg', 'glenacres-4248.jpg',
        'glenacres-4249.jpg',
    ];

    public function run(): void
    {
        // Prod: target a specific agency by its owner's email via env var
        //   GLENACRES_OWNER_EMAIL=info@propertybasket.co.za php artisan db:seed --class=GlenAcresListingSeeder --force
        // Local: default to the Sandton Realty demo agency with Sipho as the agent.
        $ownerEmail = getenv('GLENACRES_OWNER_EMAIL') ?: null;

        if ($ownerEmail) {
            $owner = User::where('email', $ownerEmail)->first();
            if (! $owner) {
                $this->command?->error("No user found for GLENACRES_OWNER_EMAIL={$ownerEmail}.");
                return;
            }
            $agency  = Agency::where('user_id', $owner->id)->first();
            $agentId = $owner->id;
        } else {
            $agency  = Agency::where('slug', 'sandton-realty')->first();
            $agentId = User::where('email', 'sipho@sandton-realty.test')->value('id');
        }

        if (! $agency) {
            $this->command?->error('Target agency not found — check GLENACRES_OWNER_EMAIL, or run DemoDataSeeder locally.');
            return;
        }

        $gallery = array_map(fn (string $f) => '/images/glen-acres/' . $f, self::IMAGE_FILES);

        $description = <<<TXT
Glen Acres Park Estate is a secure lifestyle development by G5 Properties in Midrand, where you wake up to lush green vistas, birdsong and the serenity of nature. It offers the best of both worlds — the peace and quiet of the countryside with the urban high life of the city — just 10 km from the Mall of Africa, 3 km from the Gautrain station and five minutes from Midrand's thriving commercial hub.

Five unit types are available:
• Type A — 3 bedrooms, 2 bathrooms, 85 m², from R1,285,000
• Type B — 2 bedrooms, 2 bathrooms, 86 m², from R1,119,000
• Type C — 2 bedrooms, 1 bathroom, 84 m², from R1,084,000
• Type D — 2 bedrooms, 1 bathroom, 77 m², from R977,000
• Type E — 1 bedroom, 1 bathroom, 57 m², from R669,000 (sold out)

The estate is fibre-ready with 24-hour security, a communal swimming pool, large trees and green lawns, dedicated braai areas, a clubhouse and tennis courts. A combined household income from approximately R25,000 per month is recommended for bond approval, depending on the unit type. Development by G5 Properties.
TXT;

        Listing::updateOrCreate(
            ['slug' => 'glen-acres-park-estate-midrand'],
            [
                'ulid'          => (string) Str::ulid(),
                'owner_type'    => Agency::class,
                'owner_id'      => $agency->id,
                'agent_id'      => $agentId,

                'title'         => 'Glen Acres Park Estate – Homes from R669,000 in Midrand',
                'description'   => $description,

                'listing_type'  => 'for_sale',
                'property_type' => 'apartment',
                'status'        => 'available',

                'sale_price'    => 1_285_000,

                'address'       => 'Glen Acres Park Estate, Midrand',
                'suburb'        => 'Glen Acres',
                'city'          => 'Midrand',
                'province'      => 'Gauteng',
                'postal_code'   => '1685',
                'latitude'      => -25.9990,
                'longitude'     => 28.1400,

                'bedrooms'      => 3,
                'bathrooms'     => 2,
                'area_sqm'      => 85,

                'amenities' => [
                    'Security'         => ['24-hour security'],
                    'Interior'         => ['Fibre-ready'],
                    'Exterior'         => ['Braai areas'],
                    'Estate lifestyle' => ['Communal swimming pool', 'Clubhouse', 'Tennis courts', 'Large trees and green lawns'],
                ],

                'primary_image'  => '/images/cities/johannesburg.jpg',
                'gallery_images' => $gallery,
            ]
        );

        $this->command?->info('Glen Acres listing created under ' . $agency->name . ' (' . count($gallery) . ' local images).');
    }
}
