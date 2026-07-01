<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeds a single real-world-style listing (modelled on marulaliving.co.za)
 * under the Sandton Realty agency. Images are localised under
 * public/images/marula/. Idempotent via slug.
 */
class MarulaLivingListingSeeder extends Seeder
{
    /** All gallery images, localised under public/images/marula/. */
    private const IMAGE_FILES = [
        'Marula-139.jpg', 'Marula-138.jpg', 'Marula-137.jpeg', 'Marula-140.jpg', 'Marula-148.jpg',
        'Marula-147.jpg', 'Marula-146.jpg', 'Marula-141.jpg', 'Marula-15.jpg', 'Marula-92.jpeg',
        'Marula-94.jpeg', 'Marula-98.jpg', 'Marula-100.jpg', 'Marula-99.jpg', 'Marula-136.jpg',
        'Marula-135.jpg', 'Marula-134.jpg', 'Marula-132.jpg', 'Marula-133.jpg', 'Marula-131.jpg',
        'Marula-130.jpg', 'Marula-129.jpg', 'Marula-88.jpeg', 'Marula-81.jpg', 'Marula-19.jpg',
        'Marula-23.jpg', 'Marula-119.jpg', 'Marula-120.jpg', 'Marula-121.jpg', 'Marula-125.jpg',
        'Marula-126.jpg', 'Marula-127.jpg', 'Marula-124.jpg', 'Marula-123.jpg', 'Marula-122.jpg',
        'Marula-55.jpg', 'Marula-80.jpg', 'Marula-82.jpg', 'Marula-91.jpg', 'Marula-90.jpg',
        'Marula-111.jpg', 'Marula-112.jpg', 'Marula-102.jpg', 'Marula-103.jpg', 'Marula-86.jpg',
        'Marula-104.jpg', 'Marula-105.jpg', 'Marula-106.jpg', 'Marula-79.jpg', 'Marula-83.jpg',
        'Marula-84.jpg', 'Marula-85.jpg', 'Marula-87.jpg', 'Marula-109.jpg', 'Marula-110.jpg',
        'Marula-108.jpg', 'Marula-107.jpg', 'Marula-118.jpg', 'Marula-117.jpg', 'Marula-116.jpg',
        'Marula-115.jpg', 'Marula-114.jpg', 'Marula-113.jpg', 'Marula-145.jpg', 'Marula-144.jpg',
        'Marula-143.jpg', 'Marula-142.jpg',
    ];

    public function run(): void
    {
        // Prod: target a specific agency by its owner's email via env var
        //   MARULA_OWNER_EMAIL=info@propertybasket.co.za php artisan db:seed --class=MarulaLivingListingSeeder --force
        // Local: default to the Sandton Realty demo agency with Sipho as the agent.
        $ownerEmail = getenv('MARULA_OWNER_EMAIL') ?: null;

        if ($ownerEmail) {
            $owner = User::where('email', $ownerEmail)->first();
            if (! $owner) {
                $this->command?->error("No user found for MARULA_OWNER_EMAIL={$ownerEmail}.");
                return;
            }
            $agency  = Agency::where('user_id', $owner->id)->first();
            $agentId = $owner->id;
        } else {
            $agency  = Agency::where('slug', 'sandton-realty')->first();
            $agentId = User::where('email', 'sipho@sandton-realty.test')->value('id');
        }

        if (! $agency) {
            $this->command?->error('Target agency not found — check MARULA_OWNER_EMAIL, or run DemoDataSeeder locally.');
            return;
        }

        $gallery = array_map(fn (string $f) => '/images/marula/' . $f, self::IMAGE_FILES);

        $description = <<<TXT
Marula Living is a secure lifestyle estate in Silver Lakes, Pretoria, offering a harmonious blend of nature, luxury and convenience for modern families. These freestanding homes are designed for peaceful living with direct access to the outdoors, while remaining minutes from urban amenities and the N4 highway.

This 3-bedroom, 2-bathroom home starts from 184 m² and includes two automated garages and a private garden with a built-in braai. The estate is built for resilience and sustainability — backup solar UPS and water systems, prepaid electricity, metered water and fibre-ready infrastructure throughout.

Estate lifestyle includes 24-hour security with biometric access control, hiking trails, lakes with catch-and-release fishing, picnic spots and local wildlife viewing.

Priced from R2,875,000. Estimated levies from R3,089/month (HOA and corporate levy) and rates & taxes from R2,198/month. A gross monthly income of approximately R103,855 is recommended for bond approval.
TXT;

        Listing::updateOrCreate(
            ['slug' => 'marula-living-silverlakes'],
            [
                'ulid'          => (string) Str::ulid(),
                'owner_type'    => Agency::class,
                'owner_id'      => $agency->id,
                'agent_id'      => $agentId,

                'title'         => 'Marula Living – 3 Bed Freestanding Home in Silver Lakes',
                'description'   => $description,

                'listing_type'  => 'for_sale',
                'property_type' => 'house',
                'status'        => 'available',

                'sale_price'    => 2_875_000,

                'address'       => 'Marula Living Estate, Silver Lakes',
                'suburb'        => 'Silver Lakes',
                'city'          => 'Pretoria',
                'province'      => 'Gauteng',
                'postal_code'   => '0054',
                'latitude'      => -25.7847,
                'longitude'     => 28.3389,

                'bedrooms'      => 3,
                'bathrooms'     => 2,
                'area_sqm'      => 184,

                'amenities' => [
                    'Security'         => ['24-hour security', 'Biometric access control'],
                    'Interior'         => ['Gas hob', 'Electric oven', 'Gas geyser', 'Fibre-ready'],
                    'Exterior'         => ['Automated double garage (x2)', 'Private garden', 'Built-in braai'],
                    'Sustainability'   => ['Backup solar UPS', 'Backup water system', 'Prepaid electricity', 'Metered water'],
                    'Estate lifestyle' => ['Hiking trails', 'Lakes with catch-and-release fishing', 'Picnic spots', 'Wildlife viewing'],
                ],

                'primary_image'  => '/images/marula/Marula-139.jpg',
                'gallery_images' => $gallery,
            ]
        );

        $this->command?->info('Marula Living listing created under Sandton Realty (' . count($gallery) . ' local images).');
    }
}
