<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeds a single real-world-style listing (modelled on the Blue Vista
 * development by Homes For All in Blue Hills, Midrand, listed on
 * plusgroupdirect.co.za) under the Sandton Realty agency. Images are
 * localised under public/images/blue-vista/. Idempotent via slug.
 */
class BlueVistaListingSeeder extends Seeder
{
    /** All gallery images, localised under public/images/blue-vista/. */
    private const IMAGE_FILES = [
        'bluevista-6666.jpg', 'bluevista-6667.jpg', 'bluevista-6668.jpg', 'bluevista-6669.jpg', 'bluevista-6670.jpg',
        'bluevista-6671.jpg', 'bluevista-6672.jpg', 'bluevista-6673.jpg', 'bluevista-6674.jpg', 'bluevista-6675.jpg',
        'bluevista-6676.jpg', 'bluevista-6677.jpg', 'bluevista-6678.jpg', 'bluevista-6679.jpg', 'bluevista-6680.jpg',
        'bluevista-6681.jpg', 'bluevista-6682.jpg', 'bluevista-6683.jpg', 'bluevista-6684.jpg', 'bluevista-6685.jpg',
        'bluevista-6686.jpg', 'bluevista-6687.jpg', 'bluevista-6688.jpg', 'bluevista-6689.jpg', 'bluevista-6690.jpg',
        'bluevista-6691.jpg', 'bluevista-6692.jpg', 'bluevista-6693.jpg', 'bluevista-6694.jpg', 'bluevista-6695.jpg',
        'bluevista-6696.jpg', 'bluevista-6697.jpg', 'bluevista-6698.jpg', 'bluevista-6699.jpg', 'bluevista-6700.jpg',
        'bluevista-6701.jpg', 'bluevista-6702.jpg', 'bluevista-6703.jpg', 'bluevista-6704.jpg', 'bluevista-6705.jpg',
        'bluevista-6706.jpg', 'bluevista-6707.jpg', 'bluevista-6708.jpg', 'bluevista-6709.jpg', 'bluevista-6710.jpg',
        'bluevista-6711.jpg', 'bluevista-6712.jpg', 'bluevista-6713.jpg', 'bluevista-6714.jpg', 'bluevista-6715.jpg',
        'bluevista-6716.jpg', 'bluevista-6717.jpg', 'bluevista-6718.jpg', 'bluevista-6719.jpg', 'bluevista-6720.jpg',
        'bluevista-6721.jpg', 'bluevista-6722.jpg', 'bluevista-6723.jpg', 'bluevista-6724.jpg', 'bluevista-6725.jpg',
        'bluevista-6726.jpg', 'bluevista-6727.jpg', 'bluevista-6728.jpg', 'bluevista-6729.jpg', 'bluevista-6730.jpg',
        'bluevista-6731.jpg', 'bluevista-6732.jpg', 'bluevista-6733.jpg', 'bluevista-6734.jpg', 'bluevista-6735.jpg',
        'bluevista-6736.jpg', 'bluevista-6737.jpg', 'bluevista-6738.jpg', 'bluevista-6739.jpg', 'bluevista-6740.jpg',
        'bluevista-6741.jpg', 'bluevista-6742.jpg', 'bluevista-6743.jpg', 'bluevista-6744.jpg', 'bluevista-6745.jpg',
    ];

    public function run(): void
    {
        // Prod: target a specific agency by its owner's email via env var
        //   BLUEVISTA_OWNER_EMAIL=info@propertybasket.co.za php artisan db:seed --class=BlueVistaListingSeeder --force
        // Local: default to the Sandton Realty demo agency with Sipho as the agent.
        $ownerEmail = getenv('BLUEVISTA_OWNER_EMAIL') ?: null;

        if ($ownerEmail) {
            $owner = User::where('email', $ownerEmail)->first();
            if (! $owner) {
                $this->command?->error("No user found for BLUEVISTA_OWNER_EMAIL={$ownerEmail}.");
                return;
            }
            $agency  = Agency::where('user_id', $owner->id)->first();
            $agentId = $owner->id;
        } else {
            $agency  = Agency::where('slug', 'sandton-realty')->first();
            $agentId = User::where('email', 'sipho@sandton-realty.test')->value('id');
        }

        if (! $agency) {
            $this->command?->error('Target agency not found — check BLUEVISTA_OWNER_EMAIL, or run DemoDataSeeder locally.');
            return;
        }

        $gallery = array_map(fn (string $f) => '/images/blue-vista/' . $f, self::IMAGE_FILES);

        $description = <<<TXT
Blue Vista is a modern sectional-title development by Homes For All in Blue Hills, one of Midrand's most sought-after neighbourhoods. These freestanding homes are designed for comfortable, secure and family-friendly living, offering exceptional value whether you're buying your first home or upgrading your lifestyle. All costs are included.

Three unit types are available:
• Type 1 — 2 bedrooms, 1 bathroom, 69.14 m², from R1,374,000
• Type 2 — 2 bedrooms, 1.5 bathrooms, 86.42 m², from R1,561,000
• Type 3 — 3 bedrooms, 2.5 bathrooms, 96.58 m², from R1,719,000

Homes are available as single or double storeys and feature private gardens, built-in braais, built-in cupboards, a gas hob and prepaid water. The estate offers state-of-the-art security with access control, a park and a kids' play area, and small dogs are allowed.

Blue Hills is centrally located in Midrand with easy access to filling stations, Gautrain bus stops, shopping centres, schools and hospitals nearby. A combined household income of approximately R44,959 per month is recommended for bond approval. Development by Homes For All.
TXT;

        Listing::updateOrCreate(
            ['slug' => 'blue-vista-blue-hills'],
            [
                'ulid'          => (string) Str::ulid(),
                'owner_type'    => Agency::class,
                'owner_id'      => $agency->id,
                'agent_id'      => $agentId,

                'title'         => 'Blue Vista – Freestanding Homes in Blue Hills, Midrand',
                'description'   => $description,

                'listing_type'  => 'for_sale',
                'property_type' => 'house',
                'status'        => 'available',

                'sale_price'    => 1_719_000,

                'address'       => 'Blue Vista, Blue Hills',
                'suburb'        => 'Blue Hills',
                'city'          => 'Midrand',
                'province'      => 'Gauteng',
                'postal_code'   => '1685',
                'latitude'      => -25.9556,
                'longitude'     => 28.1094,

                'bedrooms'      => 3,
                'bathrooms'     => 2.5,
                'area_sqm'      => 96.58,

                'amenities' => [
                    'Security'         => ['State-of-the-art security', 'Access control'],
                    'Interior'         => ['Built-in cupboards', 'Gas hob', 'Prepaid water', 'Single or double storeys'],
                    'Exterior'         => ['Freestanding homes', 'Private gardens', 'Built-in braai'],
                    'Estate lifestyle' => ['Park', "Kids' play area", 'Small dogs allowed', 'All costs included', 'Sectional title'],
                ],

                'primary_image'  => '/images/blue-vista/bluevista-6666.jpg',
                'gallery_images' => $gallery,
            ]
        );

        $this->command?->info('Blue Vista listing created under ' . $agency->name . ' (' . count($gallery) . ' local images).');
    }
}
