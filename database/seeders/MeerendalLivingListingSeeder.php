<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeds a single real-world-style listing (modelled on the Meerendal Living
 * development by UNiQON in Sinoville, Pretoria, listed on
 * plusgroupdirect.co.za) under the Sandton Realty agency. Images are
 * localised under public/images/meerendal/. Idempotent via slug.
 */
class MeerendalLivingListingSeeder extends Seeder
{
    /** All gallery images, localised under public/images/meerendal/. */
    private const IMAGE_FILES = [
        'meerendal-6225.jpg',        'meerendal-6226.jpg',        'meerendal-6227.jpg',        'meerendal-6228.jpg',        'meerendal-6229.jpg',
        'meerendal-6230.jpg',        'meerendal-6231.jpg',        'meerendal-6232.jpg',        'meerendal-6233.jpg',        'meerendal-6234.jpg',
        'meerendal-6235.jpg',        'meerendal-6236.jpg',        'meerendal-6237.jpg',        'meerendal-6238.jpg',        'meerendal-6239.jpg',
        'meerendal-6240.jpg',        'meerendal-6241.jpg',        'meerendal-6242.jpg',        'meerendal-6243.jpg',        'meerendal-6244.jpg',
        'meerendal-6246.jpg',        'meerendal-6247.jpg',        'meerendal-6248.jpg',        'meerendal-6249.jpg',        'meerendal-6250.jpg',
        'meerendal-6251.jpg',        'meerendal-6252.jpg',        'meerendal-6253.jpg',        'meerendal-6254.jpg',        'meerendal-6255.jpg',
        'meerendal-6256.jpg',        'meerendal-6257.jpg',        'meerendal-6258.jpg',        'meerendal-6259.jpg',        'meerendal-6260.jpg',
        'meerendal-6261.jpg',        'meerendal-6262.jpg',        'meerendal-6263.jpg',        'meerendal-6264.jpg',        'meerendal-6265.jpg',
        'meerendal-6266.jpg',        'meerendal-6267.jpg',        'meerendal-6268.jpg',        'meerendal-6269.jpg',        'meerendal-6270.jpg',
        'meerendal-6271.jpg',        'meerendal-6272.jpg',        'meerendal-6273.jpg',        'meerendal-6274.jpg',        'meerendal-6275.jpg',
        'meerendal-6276.jpg',        'meerendal-6277.jpg',        'meerendal-6278.jpg',        'meerendal-6279.jpg',        'meerendal-6280.jpg',
        'meerendal-6281.jpg',        'meerendal-6282.jpg',        'meerendal-6283.jpg',        'meerendal-6284.jpg',        'meerendal-6285.jpg',
        'meerendal-6286.jpg',        'meerendal-6287.jpg',        'meerendal-6288.jpg',        'meerendal-6289.jpg',        'meerendal-6290.jpg',
        'meerendal-6291.jpg',        'meerendal-6292.jpg',        'meerendal-6293.jpg',        'meerendal-6294.jpg',        'meerendal-6295.jpg',
        'meerendal-6296.jpg',        'meerendal-6297.jpg',        'meerendal-6298.jpg',        'meerendal-6299.jpg',        'meerendal-6300.jpg',
        'meerendal-6301.jpg',        'meerendal-6302.jpg',        'meerendal-6303.jpg',        'meerendal-6304.jpg',
    ];

    public function run(): void
    {
        // Prod: target a specific agency by its owner's email via env var
        //   MEERENDAL_OWNER_EMAIL=info@propertybasket.co.za php artisan db:seed --class=MeerendalLivingListingSeeder --force
        // Local: default to the Sandton Realty demo agency with Sipho as the agent.
        $ownerEmail = getenv('MEERENDAL_OWNER_EMAIL') ?: null;

        if ($ownerEmail) {
            $owner = User::where('email', $ownerEmail)->first();
            if (! $owner) {
                $this->command?->error("No user found for MEERENDAL_OWNER_EMAIL={$ownerEmail}.");
                return;
            }
            $agency  = Agency::where('user_id', $owner->id)->first();
            $agentId = $owner->id;
        } else {
            $agency  = Agency::where('slug', 'sandton-realty')->first();
            $agentId = User::where('email', 'sipho@sandton-realty.test')->value('id');
        }

        if (! $agency) {
            $this->command?->error('Target agency not found — check MEERENDAL_OWNER_EMAIL, or run DemoDataSeeder locally.');
            return;
        }

        $gallery = array_map(fn (string $f) => '/images/meerendal/' . $f, self::IMAGE_FILES);

        $description = <<<TXT
Meerendal Living is a brand-new double-storey development by UNiQON in the heart of Sinoville, Pretoria. Designed for families and professionals alike, it offers secure, stylish and energy-efficient homes with all costs included for your convenience.

Three double-storey unit types are available, each also offered as a rental option:
• Type A (stacked) — 2 bedrooms, 2 bathrooms, 88 m², from R1,190,000 (rental from R10,250/month)
• Type B (stacked) — 2 bedrooms, 2 bathrooms, 88 m², from R1,199,000 (rental from R10,250/month)
• Type C (stacked) — 3 bedrooms, 2 bathrooms, 170 m², from R1,999,000 (rental from R15,000/month)

Every home has an open-plan layout with quartz kitchen counters, a private garden, a patio and a built-in braai. Homes include a solar-powered geyser with inverter and solar options available, prepaid power and metered water, and are fibre-ready. The secure estate offers 24-hour security with access control and a kids' play area, minutes from Montana shopping centres, schools and Wonderboom Airport. A combined household income of approximately R42,987 per month is recommended for bond approval. Development by UNiQON.
TXT;

        Listing::updateOrCreate(
            ['slug' => 'meerendal-living-sinoville'],
            [
                'ulid'          => (string) Str::ulid(),
                'owner_type'    => Agency::class,
                'owner_id'      => $agency->id,
                'agent_id'      => $agentId,

                'title'         => 'Meerendal Living – 3 Bed Double-Storey Home in Sinoville, Pretoria',
                'description'   => $description,

                'listing_type'  => 'for_sale',
                'property_type' => 'townhouse',
                'status'        => 'available',

                'sale_price'    => 1_999_000,

                'address'       => 'Meerendal Living, Sinoville',
                'suburb'        => 'Sinoville',
                'city'          => 'Pretoria',
                'province'      => 'Gauteng',
                'postal_code'   => '0129',
                'latitude'      => -25.6660,
                'longitude'     => 28.2280,

                'bedrooms'      => 3,
                'bathrooms'     => 2,
                'area_sqm'      => 170,

                'amenities' => [
                    'Security'         => ['24-hour security', 'Access control', 'All costs included'],
                    'Interior'         => ['Open plan layout', 'Quartz kitchen counters', 'Double storey', 'Prepaid power', 'Water metered', 'Fibre-ready'],
                    'Exterior'         => ['Private garden', 'Patio', 'Built-in braai'],
                    'Sustainability'   => ['Solar-powered geyser', 'Inverter + solar options available'],
                    'Estate lifestyle' => ["Kids' play area"],
                ],

                'primary_image'  => '/images/meerendal/meerendal-6225.jpg',
                'gallery_images' => $gallery,
            ]
        );

        $this->command?->info('Meerendal Living listing created under ' . $agency->name . ' (' . count($gallery) . ' local images).');
    }
}
