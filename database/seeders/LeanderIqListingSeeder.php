<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeds a single real-world-style listing (modelled on the Leander IQ
 * development by UNiQON, listed on plusgroupdirect.co.za) under the
 * Sandton Realty agency. Images are localised under
 * public/images/leander-iq/. Idempotent via slug.
 */
class LeanderIqListingSeeder extends Seeder
{
    /** All gallery images, localised under public/images/leander-iq/. */
    private const IMAGE_FILES = [
        'leander-3215.jpg', 'leander-3216.jpg', 'leander-3217.jpg', 'leander-3218.jpg', 'leander-3219.jpg',
        'leander-3220.jpg', 'leander-3221.jpg', 'leander-3222.jpg', 'leander-3223.jpg', 'leander-3224.jpg',
        'leander-3225.jpg', 'leander-3226.jpg', 'leander-3227.jpg', 'leander-3228.jpg', 'leander-3229.jpg',
        'leander-3230.jpg', 'leander-3231.jpg', 'leander-3232.jpg', 'leander-3233.jpg', 'leander-3234.jpg',
        'leander-3235.jpg', 'leander-3236.jpg', 'leander-3237.jpg', 'leander-3238.jpg', 'leander-3239.jpg',
        'leander-3240.jpg', 'leander-3241.jpg', 'leander-3242.jpg', 'leander-3243.jpg', 'leander-3244.jpg',
        'leander-3245.jpg', 'leander-3246.jpg', 'leander-3247.jpg', 'leander-3248.jpg', 'leander-3249.jpg',
        'leander-3250.jpg', 'leander-3251.jpg', 'leander-3252.jpg', 'leander-3253.jpg', 'leander-3254.jpg',
        'leander-3255.jpg', 'leander-3256.jpg', 'leander-3257.jpg', 'leander-3258.jpg', 'leander-3259.jpg',
        'leander-3260.jpg', 'leander-3261.jpg', 'leander-3262.jpg', 'leander-3263.jpg', 'leander-3264.jpg',
        'leander-3265.jpg', 'leander-3266.jpg', 'leander-3267.jpg', 'leander-3268.jpg', 'leander-3269.jpg',
        'leander-3270.jpg', 'leander-3271.jpg', 'leander-3272.jpg', 'leander-3273.jpg', 'leander-3274.jpg',
    ];

    public function run(): void
    {
        // Prod: target a specific agency by its owner's email via env var
        //   LEANDER_OWNER_EMAIL=info@propertybasket.co.za php artisan db:seed --class=LeanderIqListingSeeder --force
        // Local: default to the Sandton Realty demo agency with Sipho as the agent.
        $ownerEmail = getenv('LEANDER_OWNER_EMAIL') ?: null;

        if ($ownerEmail) {
            $owner = User::where('email', $ownerEmail)->first();
            if (! $owner) {
                $this->command?->error("No user found for LEANDER_OWNER_EMAIL={$ownerEmail}.");
                return;
            }
            $agency  = Agency::where('user_id', $owner->id)->first();
            $agentId = $owner->id;
        } else {
            $agency  = Agency::where('slug', 'sandton-realty')->first();
            $agentId = User::where('email', 'sipho@sandton-realty.test')->value('id');
        }

        if (! $agency) {
            $this->command?->error('Target agency not found — check LEANDER_OWNER_EMAIL, or run DemoDataSeeder locally.');
            return;
        }

        $gallery = array_map(fn (string $f) => '/images/leander-iq/' . $f, self::IMAGE_FILES);

        $description = <<<TXT
Leander IQ is a modern, secure duplex development by UNiQON in Olympus AH, in the east of Pretoria. Designed for smart living and strong investment yields, these freestanding duplexes combine energy independence, low running costs and an open-plan lifestyle minutes from Silver Lakes and the N4 highway.

Two duplex layouts are available:
• Type A1 & A2 — 3 bedrooms, 2 bathrooms, double garage, 202 m², from R3,275,000
• Type A3 & A4 — 2 bedrooms, 2 bathrooms, double garage, 191 m², from R3,150,000

Every home is built for resilience and sustainability: a 5 kW solar and inverter (PV) system, a 1,500 L slimline water backup system, a solar geyser, prepaid electricity, metered water and fibre-ready infrastructure throughout. Interiors feature an open-plan design with a gas hob and electric oven, a downstairs guest toilet, and a patio with a built-in braai.

The estate is secured by 24-hour security with CCTV, a spike boom gate and a guardhouse. Olympus is a sought-after suburb offering restaurants, shopping centres, top schools and entertainment nearby, with easy highway access towards OR Tambo airport, Pretoria CBD, Johannesburg and eMalahleni.

A combined household income of approximately R99,594 per month is recommended for bond approval. PlusYield investment index: 7.4%. Development by UNiQON.
TXT;

        Listing::updateOrCreate(
            ['slug' => 'leander-iq-olympus'],
            [
                'ulid'          => (string) Str::ulid(),
                'owner_type'    => Agency::class,
                'owner_id'      => $agency->id,
                'agent_id'      => $agentId,

                'title'         => 'Leander IQ – 3 Bed Duplex in Olympus, Pretoria East',
                'description'   => $description,

                'listing_type'  => 'for_sale',
                'property_type' => 'townhouse',
                'status'        => 'available',

                'sale_price'    => 3_275_000,

                'address'       => 'Leander IQ, Olympus AH',
                'suburb'        => 'Olympus AH',
                'city'          => 'Pretoria',
                'province'      => 'Gauteng',
                'postal_code'   => '0081',
                'latitude'      => -25.7789,
                'longitude'     => 28.3299,

                'bedrooms'      => 3,
                'bathrooms'     => 2,
                'area_sqm'      => 202,

                'amenities' => [
                    'Security'       => ['24-hour security', 'CCTV', 'Spike boom gate', 'Guardhouse'],
                    'Interior'       => ['Open-plan design', 'Gas hob', 'Electric oven', 'Guest toilet downstairs', 'Fibre-ready'],
                    'Exterior'       => ['Double garage', 'Patio', 'Built-in braai'],
                    'Sustainability' => ['5 kW solar + inverter (PV system)', 'Solar geyser', '1,500 L slimline water backup', 'Prepaid electricity', 'Metered water'],
                ],

                'primary_image'  => '/images/leander-iq/leander-3215.jpg',
                'gallery_images' => $gallery,
            ]
        );

        $this->command?->info('Leander IQ listing created under ' . $agency->name . ' (' . count($gallery) . ' local images).');
    }
}
