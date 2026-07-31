<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeds a single real-world-style listing (modelled on the Paperbark Estate
 * development by Homes For All in Annlin, Pretoria, listed on
 * plusgroupdirect.co.za) under the Sandton Realty agency. Images are
 * localised under public/images/paperbark/. Idempotent via slug.
 */
class PaperbarkEstateListingSeeder extends Seeder
{
    /** All gallery images, localised under public/images/paperbark/. */
    private const IMAGE_FILES = [
        'paperbark-6488.jpg',        'paperbark-6489.jpg',        'paperbark-6490.jpg',        'paperbark-6491.jpg',        'paperbark-6492.jpg',
        'paperbark-6493.jpg',        'paperbark-6494.jpg',        'paperbark-6495.jpg',        'paperbark-6496.jpg',        'paperbark-6497.jpg',
        'paperbark-6498.jpg',        'paperbark-6499.jpg',        'paperbark-6500.jpg',        'paperbark-6501.jpg',        'paperbark-6502.jpg',
        'paperbark-6503.jpg',        'paperbark-6504.jpg',        'paperbark-6505.jpg',        'paperbark-6506.jpg',        'paperbark-6507.jpg',
        'paperbark-6508.jpg',        'paperbark-6509.jpg',        'paperbark-6510.jpg',
    ];

    public function run(): void
    {
        // Prod: target a specific agency by its owner's email via env var
        //   PAPERBARK_OWNER_EMAIL=info@propertybasket.co.za php artisan db:seed --class=PaperbarkEstateListingSeeder --force
        // Local: default to the Sandton Realty demo agency with Sipho as the agent.
        $ownerEmail = getenv('PAPERBARK_OWNER_EMAIL') ?: null;

        if ($ownerEmail) {
            $owner = User::where('email', $ownerEmail)->first();
            if (! $owner) {
                $this->command?->error("No user found for PAPERBARK_OWNER_EMAIL={$ownerEmail}.");
                return;
            }
            $agency  = Agency::where('user_id', $owner->id)->first();
            $agentId = $owner->id;
        } else {
            $agency  = Agency::where('slug', 'sandton-realty')->first();
            $agentId = User::where('email', 'sipho@sandton-realty.test')->value('id');
        }

        if (! $agency) {
            $this->command?->error('Target agency not found — check PAPERBARK_OWNER_EMAIL, or run DemoDataSeeder locally.');
            return;
        }

        $gallery = array_map(fn (string $f) => '/images/paperbark/' . $f, self::IMAGE_FILES);

        $description = <<<TXT
Paperbark Estate is a full-title development by Homes For All, nestled in the leafy, tree-laden suburb of Annlin in the heart of Pretoria. Here you own a full-title, free-standing, single or double storey home on its own private stand — offering the privacy you deserve for relaxed, joyful living, whether you're a young family or a couple seeking a slower pace. All costs are included.

Homes range from 72 m² to 168 m², with 1 to 4 bedrooms and 1 to 3 bathrooms, priced from R1,563,000 to R2,297,000. A sample of the layouts:
• Type A — 1 bedroom, 1 bathroom, 73 m², from R1,563,000
• Type B — 3 bedrooms, 2 bathrooms, from 99–122 m², from R1,783,000
• Type C — 3 bedrooms, 2 bathrooms (double storey), from 95–116 m², from R1,763,000
• Type D — 4 bedrooms, 2 bathrooms (double storey), from 104 m², from R2,009,000

Every home features private gardens, built-in cupboards, gas hobs and granite counters. The estate offers 24-hour security with access control, a park and a kids' play area. A combined household income of approximately R52,015 per month is recommended for bond approval. Development by Homes For All.
TXT;

        Listing::updateOrCreate(
            ['slug' => 'paperbark-estate-annlin'],
            [
                'ulid'          => (string) Str::ulid(),
                'owner_type'    => Agency::class,
                'owner_id'      => $agency->id,
                'agent_id'      => $agentId,

                'title'         => 'Paperbark Estate – Full-Title Homes from R1,563,000 in Annlin, Pretoria',
                'description'   => $description,

                'listing_type'  => 'for_sale',
                'property_type' => 'house',
                'status'        => 'available',

                'sale_price'    => 1_563_000,

                'address'       => 'Paperbark Estate, Annlin',
                'suburb'        => 'Annlin',
                'city'          => 'Pretoria',
                'province'      => 'Gauteng',
                'postal_code'   => '0182',
                'latitude'      => -25.6660,
                'longitude'     => 28.1930,

                'bedrooms'      => 3,
                'bathrooms'     => 2,
                'area_sqm'      => 122,

                'amenities' => [
                    'Security'         => ['24-hour security', 'Access control', 'All costs included'],
                    'Interior'         => ['Built-in cupboards', 'Gas hobs', 'Granite counters', 'Single/double storeys'],
                    'Exterior'         => ['Full-title free-standing homes', 'Private gardens', 'Own private stand'],
                    'Estate lifestyle' => ['Park', "Kids' play area"],
                ],

                'primary_image'  => '/images/paperbark/paperbark-6488.jpg',
                'gallery_images' => $gallery,
            ]
        );

        $this->command?->info('Paperbark Estate listing created under ' . $agency->name . ' (' . count($gallery) . ' local images).');
    }
}
