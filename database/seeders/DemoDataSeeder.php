<?php

namespace Database\Seeders;

use App\Enums\Role as RoleEnum;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\Contractor;
use App\Models\Landlord;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        $agencies = $this->seedAgencies();
        $landlord = $this->seedLandlord();
        $this->seedContractors();
        $this->seedListings($agencies, $landlord);
    }

    private function seedAgencies(): array
    {
        $specs = [
            [
                'name' => 'Sandton Realty',
                'slug' => 'sandton-realty',
                'owner_email' => 'owner@sandton-realty.test',
                'eaab_ffc_number' => 'FFC-2024-SR-001',
                'agents' => [
                    ['name' => 'Sipho Dlamini', 'email' => 'sipho@sandton-realty.test', 'split' => 70, 'ffc' => 'FFC-2024-SR-101'],
                    ['name' => 'Aisha Mahomed', 'email' => 'aisha@sandton-realty.test', 'split' => 70, 'ffc' => 'FFC-2024-SR-102'],
                ],
            ],
            [
                'name' => 'Atlantic Seaboard Homes',
                'slug' => 'atlantic-seaboard-homes',
                'owner_email' => 'owner@atlantic-seaboard.test',
                'eaab_ffc_number' => 'FFC-2024-AS-001',
                'agents' => [
                    ['name' => 'Tania Reddy', 'email' => 'tania@atlantic-seaboard.test', 'split' => 65, 'ffc' => 'FFC-2024-AS-101'],
                    ['name' => 'Jaco van der Merwe', 'email' => 'jaco@atlantic-seaboard.test', 'split' => 70, 'ffc' => 'FFC-2024-AS-102'],
                ],
            ],
            [
                'name' => 'Winelands Estates',
                'slug' => 'winelands-estates',
                'owner_email' => 'owner@winelands.test',
                'eaab_ffc_number' => 'FFC-2024-WE-001',
                'agents' => [
                    ['name' => 'Karabo Ndlovu', 'email' => 'karabo@winelands.test', 'split' => 70, 'ffc' => 'FFC-2024-WE-101'],
                ],
            ],
        ];

        $created = [];

        foreach ($specs as $spec) {
            $ownerUser = User::updateOrCreate(
                ['email' => $spec['owner_email']],
                [
                    'name' => $spec['name'].' (Admin)',
                    'password' => Hash::make('password'),
                    'role' => RoleEnum::AgencyAdmin,
                    'status' => UserStatus::Active,
                    'email_verified_at' => now(),
                ]
            );
            $ownerUser->syncRoles([RoleEnum::AgencyAdmin->value]);

            $agency = Agency::updateOrCreate(
                ['slug' => $spec['slug']],
                [
                    'user_id' => $ownerUser->id,
                    'name' => $spec['name'],
                    'email' => $spec['owner_email'],
                    'phone' => '+27 11 555 0'.random_int(100, 999),
                    'eaab_ffc_number' => $spec['eaab_ffc_number'],
                    'eaab_verified_at' => now(),
                    'vat_registered' => true,
                    'vat_number' => '4'.random_int(100000000, 999999999),
                    'vat_rate' => 15.00,
                    'status' => 'active',
                ]
            );

            foreach ($spec['agents'] as $index => $agentSpec) {
                $agent = User::updateOrCreate(
                    ['email' => $agentSpec['email']],
                    [
                        'name' => $agentSpec['name'],
                        'password' => Hash::make('password'),
                        'role' => RoleEnum::Agent,
                        'status' => UserStatus::Active,
                        'invited_by' => $ownerUser->id,
                        'invite_accepted_at' => now(),
                        'email_verified_at' => now(),
                    ]
                );
                $agent->syncRoles([RoleEnum::Agent->value]);

                AgencyAgent::updateOrCreate(
                    ['agency_id' => $agency->id, 'user_id' => $agent->id],
                    [
                        'commission_split_percent' => $agentSpec['split'],
                        'area_speciality' => $this->areasForAgency($spec['slug']),
                        'property_type_speciality' => ['apartment', 'house'],
                        'ffc_number' => $agentSpec['ffc'],
                        'ffc_expires_at' => now()->addYear(),
                        'lead_allocation_position' => $index,
                        'status' => 'active',
                    ]
                );
            }

            $created[$spec['slug']] = $agency->fresh('agents');
        }

        return $created;
    }

    private function seedLandlord(): Landlord
    {
        $user = User::updateOrCreate(
            ['email' => 'thandi.landlord@example.test'],
            [
                'name' => 'Thandi Mokoena',
                'phone' => '+27 82 444 0001',
                'password' => Hash::make('password'),
                'role' => RoleEnum::Landlord,
                'status' => UserStatus::Active,
                'email_verified_at' => now(),
            ]
        );
        $user->syncRoles([RoleEnum::Landlord->value]);

        return Landlord::updateOrCreate(
            ['user_id' => $user->id],
            [
                'id_number' => '8503125012088',
                'fica_verified_at' => now(),
                'property_count' => 0,
            ]
        );
    }

    private function seedContractors(): void
    {
        $contractors = [
            ['name' => 'Khanyi Plumbing', 'business' => 'Khanyi Plumbing CC', 'email' => 'jobs@khanyi-plumbing.test', 'spec' => ['plumbing', 'geysers'], 'areas' => ['Sandton', 'Fourways', 'Rosebank']],
            ['name' => 'Sparky Electrical', 'business' => 'Sparky Electrical (Pty) Ltd', 'email' => 'hello@sparky-electrical.test', 'spec' => ['electrical', 'COC certificates'], 'areas' => ['Cape Town', 'Sea Point', 'Camps Bay']],
            ['name' => 'GreenLeaf Gardens', 'business' => 'GreenLeaf Gardens', 'email' => 'team@greenleaf.test', 'spec' => ['garden', 'pool'], 'areas' => ['Stellenbosch', 'Somerset West']],
            ['name' => 'BuildRight Renovations', 'business' => 'BuildRight Renovations', 'email' => 'quotes@buildright.test', 'spec' => ['structural', 'painting'], 'areas' => ['Sandton', 'Bryanston', 'Midrand']],
        ];

        foreach ($contractors as $index => $c) {
            $user = User::updateOrCreate(
                ['email' => $c['email']],
                [
                    'name' => $c['name'],
                    'phone' => '+27 21 555 0'.($index + 100),
                    'password' => Hash::make('password'),
                    'role' => RoleEnum::Contractor,
                    'status' => UserStatus::Active,
                    'email_verified_at' => now(),
                ]
            );
            $user->syncRoles([RoleEnum::Contractor->value]);

            Contractor::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'business_name' => $c['business'],
                    'specialities' => $c['spec'],
                    'service_areas' => $c['areas'],
                    'vat_registered' => $index % 2 === 0,
                    'vat_number' => $index % 2 === 0 ? '4'.random_int(100000000, 999999999) : null,
                    'cipc_number' => '2024/'.random_int(100000, 999999).'/07',
                    'cipc_verified_at' => now(),
                    'average_rating' => round(4 + (random_int(0, 10) / 10), 1),
                    'total_reviews' => random_int(8, 60),
                    'total_jobs' => random_int(20, 180),
                    'status' => 'active',
                ]
            );
        }
    }

    private function seedListings(array $agencies, Landlord $landlord): void
    {
        $listings = [
            // Sandton Realty (for_sale + long_term_rent)
            $this->listing('Sandton Realty - 3 Bed Apartment in Sandton CBD', 'sandton-cbd-3-bed', 'for_sale', 'apartment', [
                'sale_price' => 3_750_000, 'bedrooms' => 3, 'bathrooms' => 2, 'area_sqm' => 145,
                'suburb' => 'Sandton', 'city' => 'Johannesburg', 'province' => 'Gauteng',
                'primary_image' => 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1600&q=80',
                'description' => 'Spacious 3-bed apartment with panoramic city views, 24-hour security and gym access.',
            ]),
            $this->listing('Sandton Realty - Modern Family Home in Bryanston', 'bryanston-family-home', 'for_sale', 'house', [
                'sale_price' => 8_900_000, 'bedrooms' => 5, 'bathrooms' => 4, 'area_sqm' => 480,
                'suburb' => 'Bryanston', 'city' => 'Johannesburg', 'province' => 'Gauteng',
                'primary_image' => 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80',
                'description' => 'Sprawling family estate set on 2,300m² with pool, koi pond and self-contained cottage.',
            ]),
            $this->listing('Sandton Realty - 2 Bed Rental in Rosebank', 'rosebank-2-bed-rental', 'long_term_rent', 'apartment', [
                'monthly_rent' => 18_500, 'bedrooms' => 2, 'bathrooms' => 2, 'area_sqm' => 92,
                'suburb' => 'Rosebank', 'city' => 'Johannesburg', 'province' => 'Gauteng',
                'primary_image' => 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1600&q=80',
                'description' => 'Newly renovated 2-bed, walking distance from the Gautrain station and Rosebank Mall.',
            ]),
            $this->listing('Sandton Realty - Bachelor Pad in Sandton', 'sandton-bachelor-pad', 'long_term_rent', 'apartment', [
                'monthly_rent' => 9_800, 'bedrooms' => 1, 'bathrooms' => 1, 'area_sqm' => 45,
                'suburb' => 'Sandton', 'city' => 'Johannesburg', 'province' => 'Gauteng',
                'primary_image' => 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1600&q=80',
                'description' => 'Compact, light-filled bachelor with secure parking and rooftop pool.',
            ]),

            // Atlantic Seaboard Homes
            $this->listing('Atlantic Seaboard - Sea Point Penthouse', 'sea-point-penthouse', 'for_sale', 'apartment', [
                'sale_price' => 12_500_000, 'bedrooms' => 3, 'bathrooms' => 3, 'area_sqm' => 220,
                'suburb' => 'Sea Point', 'city' => 'Cape Town', 'province' => 'Western Cape',
                'primary_image' => 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1600&q=80',
                'description' => 'Full-floor penthouse with private rooftop, plunge pool and Atlantic Ocean views.',
            ]),
            $this->listing('Atlantic Seaboard - Camps Bay Villa', 'camps-bay-villa', 'long_term_rent', 'house', [
                'monthly_rent' => 65_000, 'bedrooms' => 4, 'bathrooms' => 4, 'area_sqm' => 320,
                'suburb' => 'Camps Bay', 'city' => 'Cape Town', 'province' => 'Western Cape',
                'primary_image' => 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1600&q=80',
                'description' => 'Architectural villa with 12m heated pool, walking distance from the beach.',
            ]),
            $this->listing('Atlantic Seaboard - Clifton Bungalow Stay', 'clifton-bungalow-stay', 'short_term_stay', 'house', [
                'short_stay_nightly_price' => 4_200, 'short_stay_max_guests' => 6, 'short_stay_cleaning_fee' => 750,
                'bedrooms' => 3, 'bathrooms' => 2, 'area_sqm' => 140,
                'suburb' => 'Clifton', 'city' => 'Cape Town', 'province' => 'Western Cape',
                'primary_image' => 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=1600&q=80',
                'description' => 'Bungalow steps from Clifton 4th Beach. Sleeps 6.',
            ]),

            // Winelands Estates
            $this->listing('Winelands - Stellenbosch Wine Farm', 'stellenbosch-wine-farm', 'for_sale', 'house', [
                'sale_price' => 24_000_000, 'bedrooms' => 6, 'bathrooms' => 5, 'area_sqm' => 880,
                'suburb' => 'Stellenbosch', 'city' => 'Stellenbosch', 'province' => 'Western Cape',
                'primary_image' => 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1600&q=80',
                'description' => 'Working wine farm on 28 hectares with restored Cape Dutch manor house.',
            ]),
            $this->listing('Winelands - Cottage Rental in Franschhoek', 'franschhoek-cottage', 'long_term_rent', 'house', [
                'monthly_rent' => 22_000, 'bedrooms' => 2, 'bathrooms' => 2, 'area_sqm' => 120,
                'suburb' => 'Franschhoek', 'city' => 'Franschhoek', 'province' => 'Western Cape',
                'primary_image' => 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1600&q=80',
                'description' => 'Country cottage on a wine estate, fully furnished, dog friendly.',
            ]),
        ];

        $bySlug = [];
        foreach (['sandton-realty', 'atlantic-seaboard-homes', 'winelands-estates'] as $slug) {
            $agency = $agencies[$slug] ?? null;
            if ($agency) {
                $agentIds = $agency->agents->pluck('id')->all();
                $bySlug[$slug] = ['agency' => $agency, 'agents' => $agentIds];
            }
        }

        foreach ($listings as $payload) {
            [$agencySlug, $data] = $payload;
            $ctx = $bySlug[$agencySlug];
            $data['owner_type'] = Agency::class;
            $data['owner_id'] = $ctx['agency']->id;
            $data['agent_id'] = $ctx['agents'][array_rand($ctx['agents'])] ?? null;
            $this->createListing($data);
        }

        // Landlord-owned long-term rent
        $this->createListing([
            'owner_type' => Landlord::class,
            'owner_id' => $landlord->id,
            'agent_id' => null,
            'title' => 'Thandi - 1 Bed Garden Cottage in Greenside',
            'slug' => 'greenside-garden-cottage',
            'listing_type' => 'long_term_rent',
            'property_type' => 'apartment',
            'monthly_rent' => 7_500,
            'bedrooms' => 1,
            'bathrooms' => 1,
            'area_sqm' => 55,
            'suburb' => 'Greenside',
            'city' => 'Johannesburg',
            'province' => 'Gauteng',
            'primary_image' => 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1600&q=80',
            'description' => 'Private garden cottage behind main house. Includes water, fibre and DStv access.',
        ]);

        // Landlord-owned short-term stay
        $this->createListing([
            'owner_type' => Landlord::class,
            'owner_id' => $landlord->id,
            'agent_id' => null,
            'title' => 'Thandi - Modern Loft in Maboneng',
            'slug' => 'maboneng-loft',
            'listing_type' => 'short_term_stay',
            'property_type' => 'apartment',
            'short_stay_nightly_price' => 1_450,
            'short_stay_max_guests' => 4,
            'short_stay_cleaning_fee' => 350,
            'bedrooms' => 1,
            'bathrooms' => 1,
            'area_sqm' => 65,
            'suburb' => 'Maboneng',
            'city' => 'Johannesburg',
            'province' => 'Gauteng',
            'primary_image' => 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1600&q=80',
            'description' => 'Hip industrial-loft in the heart of the Maboneng Precinct.',
        ]);

        // Update landlord property_count
        $landlord->update(['property_count' => Listing::where('owner_type', Landlord::class)->where('owner_id', $landlord->id)->count()]);
    }

    private function listing(string $title, string $slug, string $type, string $propertyType, array $details): array
    {
        $agencySlug = match (true) {
            str_starts_with($title, 'Sandton Realty') => 'sandton-realty',
            str_starts_with($title, 'Atlantic Seaboard') => 'atlantic-seaboard-homes',
            str_starts_with($title, 'Winelands') => 'winelands-estates',
            default => 'sandton-realty',
        };

        return [
            $agencySlug,
            array_merge([
                'title' => $title,
                'slug' => $slug,
                'listing_type' => $type,
                'property_type' => $propertyType,
                'description' => $details['description'] ?? 'A lovely property.',
                'gallery_images' => [
                    $details['primary_image'] ?? null,
                    'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1600&q=80',
                    'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1600&q=80',
                ],
                'amenities' => [
                    'interior' => ['Air-con', 'Open-plan kitchen', 'Built-in cupboards'],
                    'exterior' => ['Secure parking', 'Garden'],
                ],
            ], $details),
        ];
    }

    private function createListing(array $data): Listing
    {
        $data['ulid'] ??= (string) Str::ulid();
        $data['status'] = 'available';

        return Listing::updateOrCreate(
            ['slug' => $data['slug']],
            $data
        );
    }

    private function areasForAgency(string $slug): array
    {
        return match ($slug) {
            'sandton-realty' => ['Sandton', 'Rosebank', 'Bryanston'],
            'atlantic-seaboard-homes' => ['Sea Point', 'Camps Bay', 'Clifton', 'Bantry Bay'],
            'winelands-estates' => ['Stellenbosch', 'Franschhoek', 'Paarl'],
            default => [],
        };
    }
}
