<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeds a single real-world-style listing (modelled on the Urbika Lake
 * Village development by Citydev in Parkdene, Boksburg, listed on
 * plusgroupdirect.co.za) under the Sandton Realty agency. Images are
 * localised under public/images/urbika/. Idempotent via slug.
 */
class UrbikaLakeVillageListingSeeder extends Seeder
{
    /** All gallery images, localised under public/images/urbika/. */
    private const IMAGE_FILES = [
        'urbika-6974.jpg',        'urbika-6975.jpg',        'urbika-6976.jpg',        'urbika-6977.jpg',        'urbika-6978.jpg',
        'urbika-6979.jpg',        'urbika-6980.jpg',        'urbika-6981.jpg',        'urbika-6982.jpg',        'urbika-6983.jpg',
        'urbika-6984.jpg',        'urbika-6985.jpg',        'urbika-6986.jpg',        'urbika-6987.jpg',        'urbika-6988.jpg',
        'urbika-6989.jpg',        'urbika-6990.jpg',        'urbika-6991.jpg',        'urbika-6992.jpg',        'urbika-6993.jpg',
    ];

    public function run(): void
    {
        // Prod: target a specific agency by its owner's email via env var
        //   URBIKA_OWNER_EMAIL=info@propertybasket.co.za php artisan db:seed --class=UrbikaLakeVillageListingSeeder --force
        // Local: default to the Sandton Realty demo agency with Sipho as the agent.
        $ownerEmail = getenv('URBIKA_OWNER_EMAIL') ?: null;

        if ($ownerEmail) {
            $owner = User::where('email', $ownerEmail)->first();
            if (! $owner) {
                $this->command?->error("No user found for URBIKA_OWNER_EMAIL={$ownerEmail}.");
                return;
            }
            $agency  = Agency::where('user_id', $owner->id)->first();
            $agentId = $owner->id;
        } else {
            $agency  = Agency::where('slug', 'sandton-realty')->first();
            $agentId = User::where('email', 'sipho@sandton-realty.test')->value('id');
        }

        if (! $agency) {
            $this->command?->error('Target agency not found — check URBIKA_OWNER_EMAIL, or run DemoDataSeeder locally.');
            return;
        }

        $gallery = array_map(fn (string $f) => '/images/urbika/' . $f, self::IMAGE_FILES);

        $description = <<<TXT
Urbika Lake Village is a secure residential development by Citydev in Parkdene, Boksburg, where modern design meets long-term value. These single- and double-storey full-title, freestanding homes are created for families, first-time buyers and forward-thinking investors who want to balance comfort, quality and security. All costs are included.

Homes range from 44 m² to 157 m², with 2 to 5 bedrooms and 1 to 4 bathrooms, priced from R855,000 to R1,950,000. A sample of the entry layouts:
• 44 m² — 2 bed, 1 bath, from R855,000
• 45 m² — 2 bed, 1 bath, from R874,000
• 52 m² — 2 bed, 2 bath, from R895,000
• 60 m² — 2 bed, 1 bath, from R934,000
• 65 m² — 3 bed, 2 bath, from R974,000

Each home includes a spacious, fully-fitted kitchen, a private garden, a solar geyser and prepaid electricity. The estate offers 24-hour security with biometric fingerprint access, CCTV cameras and access control, a clubhouse and kids' play areas, with easy access to the N17 and R21. A combined household income from approximately R27,976 per month is recommended for bond approval, depending on the unit. Development by Citydev.
TXT;

        Listing::updateOrCreate(
            ['slug' => 'urbika-lake-village-boksburg'],
            [
                'ulid'          => (string) Str::ulid(),
                'owner_type'    => Agency::class,
                'owner_id'      => $agency->id,
                'agent_id'      => $agentId,

                'title'         => 'Urbika Lake Village – Full-Title Homes from R855,000 in Boksburg',
                'description'   => $description,

                'listing_type'  => 'for_sale',
                'property_type' => 'house',
                'status'        => 'available',

                'sale_price'    => 855_000,

                'address'       => 'Urbika Lake Village, Parkdene',
                'suburb'        => 'Parkdene',
                'city'          => 'Boksburg',
                'province'      => 'Gauteng',
                'postal_code'   => '1459',
                'latitude'      => -26.2170,
                'longitude'     => 28.2760,

                'bedrooms'      => 2,
                'bathrooms'     => 1,
                'area_sqm'      => 44,

                'amenities' => [
                    'Security'         => ['24-hour security', 'Biometric fingerprint access', 'CCTV cameras', 'Access control', 'All costs included'],
                    'Interior'         => ['Spacious fully-fitted kitchen', 'Prepaid electricity', 'Single- & double-storey'],
                    'Exterior'         => ['Freestanding homes', 'Full-title ownership', 'Private garden'],
                    'Sustainability'   => ['Solar geyser'],
                    'Estate lifestyle' => ['Clubhouse', "Kids' play areas", 'Easy access to N17 & R21'],
                ],

                'primary_image'  => '/images/cities/johannesburg.jpg',
                'gallery_images' => $gallery,
            ]
        );

        $this->command?->info('Urbika Lake Village listing created under ' . $agency->name . ' (' . count($gallery) . ' local images).');
    }
}
