<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeds a single real-world-style listing (modelled on the Bushwillow Living
 * development by UNiQON in Six Fountains Estate, Silver Lakes, Pretoria,
 * listed on plusgroupdirect.co.za) under the Sandton Realty agency. Images
 * are localised under public/images/bushwillow/. Idempotent via slug.
 */
class BushwillowLivingListingSeeder extends Seeder
{
    /** All gallery images, localised under public/images/bushwillow/. */
    private const IMAGE_FILES = [
        'bushwillow-5936.jpg',        'bushwillow-5937.jpg',        'bushwillow-5938.jpg',        'bushwillow-5939.jpg',        'bushwillow-5940.jpg',
        'bushwillow-5941.jpg',        'bushwillow-5944.jpg',        'bushwillow-5945.jpg',        'bushwillow-5946.jpg',        'bushwillow-5947.jpg',
        'bushwillow-5949.jpg',        'bushwillow-5951.jpg',        'bushwillow-5952.jpg',        'bushwillow-5954.jpg',        'bushwillow-5955.jpg',
        'bushwillow-5958.jpg',        'bushwillow-5959.jpg',        'bushwillow-5960.jpg',        'bushwillow-5962.jpg',        'bushwillow-5964.jpg',
        'bushwillow-5965.jpg',        'bushwillow-5966.jpg',        'bushwillow-5967.jpg',        'bushwillow-5969.jpg',        'bushwillow-5970.jpg',
        'bushwillow-5971.jpg',        'bushwillow-5972.jpg',        'bushwillow-5973.jpg',        'bushwillow-5974.jpg',        'bushwillow-5975.jpg',
        'bushwillow-5976.jpg',        'bushwillow-5977.jpg',        'bushwillow-5978.jpg',        'bushwillow-5979.jpg',        'bushwillow-5980.jpg',
        'bushwillow-5981.jpg',        'bushwillow-5982.jpg',        'bushwillow-5983.jpg',        'bushwillow-5985.jpg',        'bushwillow-5986.jpg',
        'bushwillow-5987.jpg',        'bushwillow-5988.jpg',        'bushwillow-5990.jpg',        'bushwillow-5991.jpg',        'bushwillow-5992.jpg',
        'bushwillow-5993.jpg',        'bushwillow-5994.jpg',        'bushwillow-5995.jpg',        'bushwillow-5996.jpg',        'bushwillow-5997.jpg',
        'bushwillow-5998.jpg',        'bushwillow-5999.jpg',        'bushwillow-6000.jpg',        'bushwillow-6001.jpg',        'bushwillow-6002.jpg',
        'bushwillow-6003.jpg',        'bushwillow-6004.jpg',        'bushwillow-6005.jpg',        'bushwillow-6006.jpg',        'bushwillow-6007.jpg',
        'bushwillow-6008.jpg',        'bushwillow-6009.jpg',        'bushwillow-6010.jpg',        'bushwillow-6011.jpg',        'bushwillow-6012.jpg',
        'bushwillow-6013.jpg',        'bushwillow-6014.jpg',        'bushwillow-6015.jpg',        'bushwillow-6016.jpg',        'bushwillow-6017.jpg',
        'bushwillow-6018.jpg',        'bushwillow-6019.jpg',        'bushwillow-6020.jpg',        'bushwillow-6021.jpg',        'bushwillow-6022.jpg',
        'bushwillow-6023.jpg',        'bushwillow-6024.jpg',        'bushwillow-6025.jpg',        'bushwillow-6026.jpg',        'bushwillow-6027.jpg',
        'bushwillow-6028.jpg',        'bushwillow-6029.jpg',        'bushwillow-6030.jpg',        'bushwillow-6031.jpg',        'bushwillow-6032.jpg',
        'bushwillow-6033.jpg',        'bushwillow-6034.jpg',        'bushwillow-6035.jpg',        'bushwillow-6036.jpg',        'bushwillow-6037.jpg',
        'bushwillow-6038.jpg',        'bushwillow-6039.jpg',        'bushwillow-6040.jpg',        'bushwillow-6041.jpg',        'bushwillow-6042.jpg',
        'bushwillow-6043.jpg',        'bushwillow-6044.jpg',        'bushwillow-6045.jpg',        'bushwillow-6046.jpg',        'bushwillow-6047.jpg',
        'bushwillow-6048.jpg',        'bushwillow-6049.jpg',
    ];

    public function run(): void
    {
        // Prod: target a specific agency by its owner's email via env var
        //   BUSHWILLOW_OWNER_EMAIL=info@propertybasket.co.za php artisan db:seed --class=BushwillowLivingListingSeeder --force
        // Local: default to the Sandton Realty demo agency with Sipho as the agent.
        $ownerEmail = getenv('BUSHWILLOW_OWNER_EMAIL') ?: null;

        if ($ownerEmail) {
            $owner = User::where('email', $ownerEmail)->first();
            if (! $owner) {
                $this->command?->error("No user found for BUSHWILLOW_OWNER_EMAIL={$ownerEmail}.");
                return;
            }
            $agency  = Agency::where('user_id', $owner->id)->first();
            $agentId = $owner->id;
        } else {
            $agency  = Agency::where('slug', 'sandton-realty')->first();
            $agentId = User::where('email', 'sipho@sandton-realty.test')->value('id');
        }

        if (! $agency) {
            $this->command?->error('Target agency not found — check BUSHWILLOW_OWNER_EMAIL, or run DemoDataSeeder locally.');
            return;
        }

        $gallery = array_map(fn (string $f) => '/images/bushwillow/' . $f, self::IMAGE_FILES);

        $description = <<<TXT
Bushwillow Living is an exciting new development by UNiQON in the secure Six Fountains Estate, Silver Lakes — one of Pretoria's most sought-after locations. These freestanding homes combine comfort, convenience and peace of mind, with spacious layouts and luxury finishes throughout, designed to suit the needs of today's families while balancing relaxation and functionality. All costs are included.

Type B1-5 homes offer 3 bedrooms, 2 bathrooms and a double automated garage across 183 m², priced from R2,875,000. Each home features a gas hob and electric oven, built-in cupboards, a separate scullery, a private garden with a built-in braai, and is fibre-ready.

Built for resilience, every home includes a solar geyser and backup power and water systems. The pet-friendly security estate offers communal green spaces and a kids' play area, and sits minutes from Hazeldean Square, Six Fountains Lifestyle Centre, top schools and Intercare Silver Lakes. A combined household income of approximately R103,855 per month is recommended for bond approval. Development by UNiQON.
TXT;

        Listing::updateOrCreate(
            ['slug' => 'bushwillow-living-six-fountains'],
            [
                'ulid'          => (string) Str::ulid(),
                'owner_type'    => Agency::class,
                'owner_id'      => $agency->id,
                'agent_id'      => $agentId,

                'title'         => 'Bushwillow Living – 3 Bed Freestanding Home in Six Fountains, Silver Lakes',
                'description'   => $description,

                'listing_type'  => 'for_sale',
                'property_type' => 'house',
                'status'        => 'available',

                'sale_price'    => 2_875_000,

                'address'       => 'Bushwillow Living, Six Fountains Estate',
                'suburb'        => 'Six Fountains',
                'city'          => 'Pretoria',
                'province'      => 'Gauteng',
                'postal_code'   => '0081',
                'latitude'      => -25.7830,
                'longitude'     => 28.3480,

                'bedrooms'      => 3,
                'bathrooms'     => 2,
                'area_sqm'      => 183,

                'amenities' => [
                    'Security'         => ['Security estate', 'All costs included'],
                    'Interior'         => ['Gas hob', 'Electric oven', 'Built-in cupboards', 'Separate scullery', 'Fibre-ready'],
                    'Exterior'         => ['Double automated garage', 'Private garden', 'Built-in braai'],
                    'Sustainability'   => ['Solar geyser', 'Backup power', 'Backup water'],
                    'Estate lifestyle' => ['Pet friendly', 'Communal green spaces', "Kids' play area"],
                ],

                'primary_image'  => '/images/bushwillow/bushwillow-5936.jpg',
                'gallery_images' => $gallery,
            ]
        );

        $this->command?->info('Bushwillow Living listing created under ' . $agency->name . ' (' . count($gallery) . ' local images).');
    }
}
