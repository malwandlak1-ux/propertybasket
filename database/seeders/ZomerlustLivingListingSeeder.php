<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeds a single real-world-style listing (modelled on the Zomerlust Living
 * development by UNiQON in Boardwalk Villas, Pretoria, listed on
 * plusgroupdirect.co.za) under the Sandton Realty agency. Images are
 * localised under public/images/zomerlust/. Idempotent via slug.
 */
class ZomerlustLivingListingSeeder extends Seeder
{
    /** All gallery images, localised under public/images/zomerlust/. */
    private const IMAGE_FILES = [
        'zomerlust-4579.jpg',        'zomerlust-4580.jpg',        'zomerlust-4581.jpg',        'zomerlust-4582.jpg',        'zomerlust-4583.jpg',
        'zomerlust-4584.jpg',        'zomerlust-4585.jpg',        'zomerlust-4586.jpg',        'zomerlust-4587.jpg',        'zomerlust-4588.jpg',
        'zomerlust-4589.jpg',        'zomerlust-4590.jpg',        'zomerlust-4591.jpg',        'zomerlust-4592.jpg',        'zomerlust-4593.jpg',
        'zomerlust-4594.jpg',        'zomerlust-4595.jpg',        'zomerlust-4596.jpg',        'zomerlust-4597.jpg',        'zomerlust-4598.jpg',
        'zomerlust-4599.jpg',        'zomerlust-4600.jpg',        'zomerlust-4601.jpg',        'zomerlust-4602.jpg',        'zomerlust-4603.jpg',
        'zomerlust-4604.jpg',        'zomerlust-4605.jpg',        'zomerlust-4606.jpg',        'zomerlust-4607.jpg',        'zomerlust-4608.jpg',
        'zomerlust-4609.jpg',        'zomerlust-4610.jpg',        'zomerlust-4611.jpg',        'zomerlust-4612.jpg',        'zomerlust-4613.jpg',
        'zomerlust-4614.jpg',        'zomerlust-4615.jpg',        'zomerlust-4616.jpg',        'zomerlust-4617.jpg',        'zomerlust-4618.jpg',
        'zomerlust-4619.jpg',        'zomerlust-4620.jpg',        'zomerlust-4621.jpg',        'zomerlust-4622.jpg',        'zomerlust-4623.jpg',
        'zomerlust-4624.jpg',        'zomerlust-4625.jpg',        'zomerlust-4626.jpg',        'zomerlust-4627.jpg',        'zomerlust-4628.jpg',
        'zomerlust-4629.jpg',        'zomerlust-4630.jpg',        'zomerlust-4631.jpg',        'zomerlust-4632.jpg',        'zomerlust-4633.jpg',
        'zomerlust-4634.jpg',        'zomerlust-4635.jpg',        'zomerlust-4636.jpg',
    ];

    public function run(): void
    {
        // Prod: target a specific agency by its owner's email via env var
        //   ZOMERLUST_OWNER_EMAIL=info@propertybasket.co.za php artisan db:seed --class=ZomerlustLivingListingSeeder --force
        // Local: default to the Sandton Realty demo agency with Sipho as the agent.
        $ownerEmail = getenv('ZOMERLUST_OWNER_EMAIL') ?: null;

        if ($ownerEmail) {
            $owner = User::where('email', $ownerEmail)->first();
            if (! $owner) {
                $this->command?->error("No user found for ZOMERLUST_OWNER_EMAIL={$ownerEmail}.");
                return;
            }
            $agency  = Agency::where('user_id', $owner->id)->first();
            $agentId = $owner->id;
        } else {
            $agency  = Agency::where('slug', 'sandton-realty')->first();
            $agentId = User::where('email', 'sipho@sandton-realty.test')->value('id');
        }

        if (! $agency) {
            $this->command?->error('Target agency not found — check ZOMERLUST_OWNER_EMAIL, or run DemoDataSeeder locally.');
            return;
        }

        $gallery = array_map(fn (string $f) => '/images/zomerlust/' . $f, self::IMAGE_FILES);

        $description = <<<TXT
Zomerlust Living is a modern, secure sectional-title development by UNiQON in Boardwalk Villas, Pretoria East, set in tranquil surroundings within a safe and secure estate. Each home combines comfort and energy independence with high-end finishes.

Two unit types are available:
• Type A (simplex) — 3 bedrooms, 2 bathrooms, 100 m², from R2,499,000
• Type C (stack) — 2 bedrooms, 2 bathrooms, 83 m², from R1,650,000

Homes feature a gas stove with electric oven, a gas geyser, a private garden and a double garage or carport. Simplex units include a 5 kW inverter with 4 solar panels and a 5 kWh lithium battery; stack units include a 3 kW inverter with 2 solar panels and a 2.5 kWh lithium battery. A reliable backup water supply (not for human consumption), prepaid electricity and individual water meters keep running costs in check.

The estate offers 24-hour security with CCTV surveillance and high-speed fibre, minutes from Olympus Village, Boardwalk Lakeside, top schools and medical facilities. A combined household income of approximately R59,603 per month is recommended for bond approval. Development by UNiQON.
TXT;

        Listing::updateOrCreate(
            ['slug' => 'zomerlust-living-boardwalk'],
            [
                'ulid'          => (string) Str::ulid(),
                'owner_type'    => Agency::class,
                'owner_id'      => $agency->id,
                'agent_id'      => $agentId,

                'title'         => 'Zomerlust Living – 3 Bed Home in Boardwalk Villas, Pretoria',
                'description'   => $description,

                'listing_type'  => 'for_sale',
                'property_type' => 'townhouse',
                'status'        => 'available',

                'sale_price'    => 2_499_000,

                'address'       => 'Zomerlust Living, Boardwalk Villas',
                'suburb'        => 'Boardwalk Villas',
                'city'          => 'Pretoria',
                'province'      => 'Gauteng',
                'postal_code'   => '0043',
                'latitude'      => -25.8000,
                'longitude'     => 28.3200,

                'bedrooms'      => 3,
                'bathrooms'     => 2,
                'area_sqm'      => 100,

                'amenities' => [
                    'Security'       => ['24-hour security', 'CCTV surveillance', 'Safe and secure estate'],
                    'Interior'       => ['Gas stove with electric oven', 'Gas geyser', 'High-speed fibre', 'Prepaid electricity', 'Individual water meters'],
                    'Exterior'       => ['Private garden', 'Double garage or carport'],
                    'Sustainability' => ['Solar inverter + panels + lithium battery', 'Reliable backup water supply'],
                    'Lifestyle'      => ['Sectional title homes', 'Tranquil surroundings'],
                ],

                'primary_image'  => '/images/zomerlust/zomerlust-4579.jpg',
                'gallery_images' => $gallery,
            ]
        );

        $this->command?->info('Zomerlust Living listing created under ' . $agency->name . ' (' . count($gallery) . ' local images).');
    }
}
