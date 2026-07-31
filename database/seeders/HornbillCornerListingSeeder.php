<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeds a single real-world-style listing (modelled on the Hornbill Corner
 * development by AFHCO in Montana Tuine, Pretoria North, listed on
 * plusgroupdirect.co.za) under the Sandton Realty agency. Images are
 * localised under public/images/hornbill/. Idempotent via slug.
 */
class HornbillCornerListingSeeder extends Seeder
{
    /** All gallery images, localised under public/images/hornbill/. */
    private const IMAGE_FILES = [
        'hornbill-725.jpg',        'hornbill-726.jpg',        'hornbill-727.jpg',        'hornbill-728.jpg',        'hornbill-729.jpg',
        'hornbill-730.jpg',        'hornbill-731.jpg',        'hornbill-732.jpg',        'hornbill-733.jpg',        'hornbill-734.jpg',
        'hornbill-735.jpg',        'hornbill-736.jpg',        'hornbill-737.jpg',        'hornbill-738.jpg',        'hornbill-739.jpg',
        'hornbill-740.jpg',        'hornbill-741.jpg',        'hornbill-742.jpg',        'hornbill-743.jpg',        'hornbill-744.jpg',
        'hornbill-745.jpg',        'hornbill-746.jpg',        'hornbill-747.jpg',        'hornbill-748.jpg',        'hornbill-749.jpg',
        'hornbill-750.jpg',        'hornbill-751.jpg',        'hornbill-752.jpg',        'hornbill-753.jpg',        'hornbill-754.jpg',
        'hornbill-755.jpg',        'hornbill-756.jpg',        'hornbill-757.jpg',        'hornbill-758.jpg',        'hornbill-759.jpg',
        'hornbill-760.jpg',        'hornbill-761.jpg',        'hornbill-762.jpg',        'hornbill-763.jpg',        'hornbill-764.jpg',
        'hornbill-765.jpg',        'hornbill-766.jpg',        'hornbill-767.jpg',        'hornbill-768.jpg',        'hornbill-769.jpg',
        'hornbill-770.jpg',        'hornbill-771.jpg',        'hornbill-772.jpg',        'hornbill-773.jpg',        'hornbill-774.jpg',
        'hornbill-775.jpg',        'hornbill-776.jpg',        'hornbill-777.jpg',        'hornbill-778.jpg',        'hornbill-779.jpg',
        'hornbill-780.jpg',        'hornbill-781.jpg',        'hornbill-782.jpg',        'hornbill-783.jpg',        'hornbill-784.jpg',
        'hornbill-785.jpg',        'hornbill-786.jpg',        'hornbill-787.jpg',        'hornbill-788.jpg',
    ];

    public function run(): void
    {
        // Prod: target a specific agency by its owner's email via env var
        //   HORNBILL_OWNER_EMAIL=info@propertybasket.co.za php artisan db:seed --class=HornbillCornerListingSeeder --force
        // Local: default to the Sandton Realty demo agency with Sipho as the agent.
        $ownerEmail = getenv('HORNBILL_OWNER_EMAIL') ?: null;

        if ($ownerEmail) {
            $owner = User::where('email', $ownerEmail)->first();
            if (! $owner) {
                $this->command?->error("No user found for HORNBILL_OWNER_EMAIL={$ownerEmail}.");
                return;
            }
            $agency  = Agency::where('user_id', $owner->id)->first();
            $agentId = $owner->id;
        } else {
            $agency  = Agency::where('slug', 'sandton-realty')->first();
            $agentId = User::where('email', 'sipho@sandton-realty.test')->value('id');
        }

        if (! $agency) {
            $this->command?->error('Target agency not found — check HORNBILL_OWNER_EMAIL, or run DemoDataSeeder locally.');
            return;
        }

        $gallery = array_map(fn (string $f) => '/images/hornbill/' . $f, self::IMAGE_FILES);

        $description = <<<TXT
Hornbill Corner is a development by AFHCO of beautifully and meticulously designed 2- and 3-bedroom upmarket homes that will make you feel like you're on holiday every day. Perfectly situated in the quiet, sought-after suburb of Montana Gardens (Montana Tuine), Pretoria North, with all costs included.

Three unit types were released:
• Stack unit — 2 bedrooms, 2 bathrooms, 75 m², from R889,000 (sold out)
• Simplex — 2 bedrooms, 2 bathrooms, 104 m², from R1,295,000 (sold out)
• Duplex — 3 bedrooms, 2.5 bathrooms, 150 m², from R2,050,000

Every home features a solar geyser, prepaid electricity, porcelain tiles, big gardens on a green lung and upmarket finishes, all behind 24-hour security with guards. A combined household income of approximately R30,000 per month is recommended for bond approval. Development by AFHCO.
TXT;

        Listing::updateOrCreate(
            ['slug' => 'hornbill-corner-montana'],
            [
                'ulid'          => (string) Str::ulid(),
                'owner_type'    => Agency::class,
                'owner_id'      => $agency->id,
                'agent_id'      => $agentId,

                'title'         => 'Hornbill Corner – 3 Bed Duplex in Montana Gardens, Pretoria North',
                'description'   => $description,

                'listing_type'  => 'for_sale',
                'property_type' => 'townhouse',
                'status'        => 'available',

                'sale_price'    => 2_050_000,

                'address'       => 'Hornbill Corner, Montana Tuine',
                'suburb'        => 'Montana Tuine',
                'city'          => 'Pretoria',
                'province'      => 'Gauteng',
                'postal_code'   => '0182',
                'latitude'      => -25.6560,
                'longitude'     => 28.2360,

                'bedrooms'      => 3,
                'bathrooms'     => 2.5,
                'area_sqm'      => 150,

                'amenities' => [
                    'Security'       => ['24-hour security and guards', 'All costs included'],
                    'Interior'       => ['Porcelain tiles', 'Prepaid electricity', 'Upmarket finishes'],
                    'Exterior'       => ['Big gardens – green lung'],
                    'Sustainability' => ['Solar geyser'],
                ],

                'primary_image'  => '/images/hornbill/hornbill-725.jpg',
                'gallery_images' => $gallery,
            ]
        );

        $this->command?->info('Hornbill Corner listing created under ' . $agency->name . ' (' . count($gallery) . ' local images).');
    }
}
