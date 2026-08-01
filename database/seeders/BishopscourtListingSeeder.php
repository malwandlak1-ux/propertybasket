<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeds a single real-world-style listing (modelled on the Bishopscourt
 * student-accommodation development by UNiQON in Brooklyn, Pretoria, listed
 * on plusgroupdirect.co.za) under the Sandton Realty agency. Images are
 * localised under public/images/bishopscourt/. Idempotent via slug.
 */
class BishopscourtListingSeeder extends Seeder
{
    /** All gallery images, localised under public/images/bishopscourt/. */
    private const IMAGE_FILES = [
        'bishopscourt-6308.jpg',        'bishopscourt-6309.jpg',        'bishopscourt-6310.jpg',        'bishopscourt-6311.jpg',        'bishopscourt-6312.jpg',
        'bishopscourt-6313.jpg',        'bishopscourt-6314.jpg',        'bishopscourt-6315.jpg',        'bishopscourt-6316.jpg',        'bishopscourt-6317.jpg',
        'bishopscourt-6318.jpg',        'bishopscourt-6319.jpg',        'bishopscourt-6321.jpg',        'bishopscourt-6322.jpg',        'bishopscourt-6323.jpg',
        'bishopscourt-6324.jpg',        'bishopscourt-6325.jpg',        'bishopscourt-6326.jpg',        'bishopscourt-6331.jpg',        'bishopscourt-6332.jpg',
        'bishopscourt-6333.jpg',        'bishopscourt-6334.jpg',        'bishopscourt-6335.jpg',        'bishopscourt-6336.jpg',        'bishopscourt-6337.jpg',
        'bishopscourt-6338.jpg',        'bishopscourt-6339.jpg',        'bishopscourt-6340.jpg',        'bishopscourt-6341.jpg',        'bishopscourt-6342.jpg',
        'bishopscourt-6343.jpg',        'bishopscourt-6344.jpg',        'bishopscourt-6345.jpg',        'bishopscourt-6346.jpg',        'bishopscourt-6347.jpg',
        'bishopscourt-6348.jpg',        'bishopscourt-6349.jpg',        'bishopscourt-6350.jpg',        'bishopscourt-6351.jpg',        'bishopscourt-6352.jpg',
        'bishopscourt-6354.jpg',
    ];

    public function run(): void
    {
        // Prod: target a specific agency by its owner's email via env var
        //   BISHOPSCOURT_OWNER_EMAIL=info@propertybasket.co.za php artisan db:seed --class=BishopscourtListingSeeder --force
        // Local: default to the Sandton Realty demo agency with Sipho as the agent.
        $ownerEmail = getenv('BISHOPSCOURT_OWNER_EMAIL') ?: null;

        if ($ownerEmail) {
            $owner = User::where('email', $ownerEmail)->first();
            if (! $owner) {
                $this->command?->error("No user found for BISHOPSCOURT_OWNER_EMAIL={$ownerEmail}.");
                return;
            }
            $agency  = Agency::where('user_id', $owner->id)->first();
            $agentId = $owner->id;
        } else {
            $agency  = Agency::where('slug', 'sandton-realty')->first();
            $agentId = User::where('email', 'sipho@sandton-realty.test')->value('id');
        }

        if (! $agency) {
            $this->command?->error('Target agency not found — check BISHOPSCOURT_OWNER_EMAIL, or run DemoDataSeeder locally.');
            return;
        }

        $gallery = array_map(fn (string $f) => '/images/bishopscourt/' . $f, self::IMAGE_FILES);

        $description = <<<TXT
Bishopscourt is a next-level student-accommodation development by UNiQON in the heart of Brooklyn, Pretoria, just 3 minutes from the University of Pretoria. With all costs included and premium features designed for comfort, convenience and security, it's more than a place to stay — it's a lifestyle upgrade.

Two unit types are available, each 2 bedrooms and 2 bathrooms:
• Type 1 — 67 m², from R1,975,000 (rental from R12,000/month)
• Type 2 — 70 m², from R1,975,000 (rental from R14,000/month)

Every unit features a gas hob, a built-in microwave/airfryer combo, built-in cupboards, prepaid power and metered water, and is fibre-ready. The building offers 24-hour security with keyless access control, backup power and a backup water system, a padel court, braai facilities and secure basement parking.

Superbly located, it is minutes from Brooklyn Square, the Hatfield Gautrain station and the University of Pretoria. A combined household income of approximately R71,344 per month is recommended for bond approval. Development by UNiQON.
TXT;

        Listing::updateOrCreate(
            ['slug' => 'bishopscourt-brooklyn'],
            [
                'ulid'          => (string) Str::ulid(),
                'owner_type'    => Agency::class,
                'owner_id'      => $agency->id,
                'agent_id'      => $agentId,

                'title'         => 'Bishopscourt – 2 Bed Student Apartment in Brooklyn, Pretoria',
                'description'   => $description,

                'listing_type'  => 'for_sale',
                'property_type' => 'apartment',
                'status'        => 'available',

                'sale_price'    => 1_975_000,

                'address'       => 'Bishopscourt, Brooklyn',
                'suburb'        => 'Brooklyn',
                'city'          => 'Pretoria',
                'province'      => 'Gauteng',
                'postal_code'   => '0181',
                'latitude'      => -25.7640,
                'longitude'     => 28.2380,

                'bedrooms'      => 2,
                'bathrooms'     => 2,
                'area_sqm'      => 70,

                'amenities' => [
                    'Security'         => ['24-hour security', 'Keyless access control', 'Secure basement parking', 'All costs included'],
                    'Interior'         => ['Gas hob', 'Built-in microwave/airfryer combo', 'Built-in cupboards', 'Prepaid power', 'Water metered', 'Fibre-ready'],
                    'Sustainability'   => ['Backup power', 'Backup water system'],
                    'Estate lifestyle' => ['Padel court', 'Braai facilities', '3 minutes from University of Pretoria'],
                ],

                'primary_image'  => '/images/bishopscourt/bishopscourt-6308.jpg',
                'gallery_images' => $gallery,
            ]
        );

        $this->command?->info('Bishopscourt listing created under ' . $agency->name . ' (' . count($gallery) . ' local images).');
    }
}
