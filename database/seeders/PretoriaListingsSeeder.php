<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeds four Pretoria sectional-title flats marketed by the agency's agent.
 * Images live in public/images/listings/<slug>/ (committed to the repo, so
 * the deploy script carries them to staging/prod).
 *
 * Target agency by its owner's email:
 *   LISTINGS_OWNER_EMAIL=owner@example.com php artisan db:seed --class=PretoriaListingsSeeder --force
 * Local default: the Sandton Realty demo agency.
 *
 * Idempotent via slug — safe to re-run after edits.
 */
class PretoriaListingsSeeder extends Seeder
{
    public function run(): void
    {
        $ownerEmail = getenv('LISTINGS_OWNER_EMAIL') ?: null;

        if ($ownerEmail) {
            $owner = User::where('email', $ownerEmail)->first();
            if (! $owner) {
                $this->command?->error("No user found for LISTINGS_OWNER_EMAIL={$ownerEmail}.");
                return;
            }
            $agency  = Agency::where('user_id', $owner->id)->first();
            $agentId = $owner->id;
        } else {
            $agency  = Agency::where('slug', 'sandton-realty')->first();
            $agentId = User::where('email', 'sipho@sandton-realty.test')->value('id');
        }

        if (! $agency) {
            $this->command?->error('Target agency not found — check LISTINGS_OWNER_EMAIL, or run DemoDataSeeder locally.');
            return;
        }

        foreach ($this->listings() as $data) {
            Listing::updateOrCreate(
                ['slug' => $data['slug']],
                array_merge($data, [
                    'ulid'          => (string) Str::ulid(),
                    'owner_type'    => Agency::class,
                    'owner_id'      => $agency->id,
                    'agent_id'      => $agentId,
                    'listing_type'  => 'for_sale',
                    'property_type' => 'apartment',
                    'status'        => 'available',
                    'city'          => 'Pretoria',
                    'province'      => 'Gauteng',
                ])
            );
        }

        $this->command?->info(count($this->listings()) . " Pretoria listings created under '{$agency->name}'.");
    }

    private function listings(): array
    {
        return [
            [
                'slug'        => 'poku-unit-8-muckleneuk',
                'title'       => '18 Poku Unit 8 – 2 Bed Flat in Muckleneuk',
                'sale_price'  => 450_000,
                'bedrooms'    => 2,
                'bathrooms'   => 1,
                'area_sqm'    => 55,
                'address'     => '18 Poku, Unit 8, 491 Justice Mahomed Street',
                'suburb'      => 'Muckleneuk',
                'description' => "Sectional-title flat (scheme SS104/1984, Portion 1 of Erf 310) in the established suburb of Muckleneuk, minutes from the Pretoria CBD, UNISA and main commuter routes.\n\nRegistered as a 2-bedroom, 1-bathroom unit of 55 m², the flat is currently configured as a 3-bedroom: the lounge has been converted into an additional bedroom — ideal for investors targeting rental income, or easily reverted to a standard 2-bed with lounge.\n\nPriced at R450,000, this is an affordable entry into a well-located sectional scheme.",
                'amenities'   => [
                    'Unit'   => ['2 bedrooms (currently configured as 3)', '1 bathroom', '55 m² floor area'],
                    'Scheme' => ['Sectional title (SS104/1984)', 'Established Muckleneuk block'],
                ],
                'primary_image'  => '/images/listings/poku/poku.jpg',
                'gallery_images' => ['/images/listings/poku/poku.jpg'],
            ],
            [
                'slug'        => 'soldonne-unit-120-the-orchards',
                'title'       => '120 Soldonne – 2 Bed Flat in The Orchards Ext 33',
                'sale_price'  => 564_000,
                'bedrooms'    => 2,
                'bathrooms'   => 1,
                'area_sqm'    => 62,
                'address'     => '120 Soldonne, Unit 120, 6889 Bosvlier Street',
                'suburb'      => 'The Orchards Ext 33',
                'description' => "Neat 2-bedroom, 1-bathroom sectional-title unit of 62 m² (scheme SS64/2009, Erf 8611) in the popular Soldonne complex in The Orchards Ext 33, Akasia — a family-friendly area with easy access to schools, shopping and the R80.\n\nThe unit offers a lounge, a covered carport plus an additional open parking bay. The scheme is professionally managed by Coleman Properties.\n\nMonthly levies: R1,124.11 base + R12.48 CSOS + R242.12 reserve fund + R323.75 security, with water & sewerage billed to the unit. Priced at R564,000.",
                'amenities'   => [
                    'Unit'    => ['2 bedrooms', '1 bathroom', 'Lounge', '62 m² floor area'],
                    'Parking' => ['Covered carport', 'Open parking bay'],
                    'Scheme'  => ['Sectional title (SS64/2009)', 'Managed by Coleman Properties', 'Security levy scheme'],
                ],
                'primary_image'  => '/images/listings/soldonne/soldonne-01.jpg',
                'gallery_images' => [
                    '/images/listings/soldonne/soldonne-01.jpg',
                    '/images/listings/soldonne/soldonne-02.jpg',
                    '/images/listings/soldonne/soldonne-03.jpg',
                    '/images/listings/soldonne/soldonne-04.jpg',
                    '/images/listings/soldonne/soldonne-05.jpg',
                    '/images/listings/soldonne/soldonne-06.jpg',
                    '/images/listings/soldonne/soldonne-07.jpg',
                    '/images/listings/soldonne/soldonne-08.jpg',
                    '/images/listings/soldonne/soldonne-09.jpg',
                    '/images/listings/soldonne/soldonne-10.jpg',
                    '/images/listings/soldonne/soldonne-11.jpg',
                    '/images/listings/soldonne/soldonne-12.jpg',
                    '/images/listings/soldonne/soldonne-13.jpg',
                ],
            ],
            [
                'slug'        => 'stocks-city-south-unit-34-sunnyside',
                'title'       => '401 Stocks City South – 2 Bed Flat in Sunnyside',
                'sale_price'  => 544_000,
                'bedrooms'    => 2,
                'bathrooms'   => 1,
                'area_sqm'    => 76,
                'address'     => '401 Stocks City South, Unit 34, 180 Steve Biko Street',
                'suburb'      => 'Sunnyside',
                'description' => "Spacious 76 m² sectional-title flat (scheme SS71/1980, Erf 1356) in the well-known Stocks City complex on Steve Biko Street, Sunnyside — walking distance from shops, transport and city amenities.\n\nThe unit offers 2 bedrooms, 1 bathroom, plus a separate lounge AND dining room — a generous layout at this price point. The scheme is managed by Pro-Admin.\n\nMonthly levies: R1,385.84 base + R52.50 parking + R17.72 CSOS + R287.54 reserve fund. Priced at R544,000.",
                'amenities'   => [
                    'Unit'    => ['2 bedrooms', '1 bathroom', 'Lounge', 'Dining room', '76 m² floor area'],
                    'Parking' => ['Parking bay (levied)'],
                    'Scheme'  => ['Sectional title (SS71/1980)', 'Managed by Pro-Admin'],
                ],
                'primary_image'  => '/images/listings/stocks-city-south/stocks-city-south.jpg',
                'gallery_images' => ['/images/listings/stocks-city-south/stocks-city-south.jpg'],
            ],
            [
                'slug'        => 'swellendam-unit-41-pretoria',
                'title'       => 'Swellendam Unit 41 – Spacious 2 Bed Flat',
                'sale_price'  => 575_000,
                'bedrooms'    => 2,
                'bathrooms'   => 1,
                'area_sqm'    => 90,
                // TODO: street address + suburb still to be confirmed by the agent.
                'address'     => null,
                'suburb'      => null,
                'description' => "Exceptionally spacious 90 m² sectional-title flat (scheme SS26/1980, Erf 1181, Unit 41) in the Swellendam building, Pretoria.\n\nThe unit offers 2 bedrooms, 1 bathroom, a lounge and a separate dining room — one of the larger 2-bed layouts you'll find at this price. The scheme is managed by Pro-Admin.\n\nMonthly levies: R2,073.72. Priced at R575,000.",
                'amenities'   => [
                    'Unit'   => ['2 bedrooms', '1 bathroom', 'Lounge', 'Dining room', '90 m² floor area'],
                    'Scheme' => ['Sectional title (SS26/1980)', 'Managed by Pro-Admin'],
                ],
                'primary_image'  => '/images/listings/swellendam/swellendam.jpg',
                'gallery_images' => ['/images/listings/swellendam/swellendam.jpg'],
            ],
        ];
    }
}
