<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\AgencyWebsite;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Publishes a demo agency website for Sandton Realty on the editorial
 * template, with bios for its agents. Idempotent.
 *
 * Local: http://sandton-realty.localhost:8090 (with SITES_PORT=8090).
 */
class WebsiteDemoSeeder extends Seeder
{
    public function run(): void
    {
        $agency = Agency::where('slug', 'sandton-realty')->first()
            ?? Agency::where('name', 'like', 'Sandton Realty%')->first();
        if (! $agency) {
            $this->command?->warn('Sandton Realty not found — run the demo seeders first.');

            return;
        }

        $hero = Listing::publiclyVisible()->forAgency($agency)->whereNotNull('primary_image')->latest()->value('primary_image');

        AgencyWebsite::updateOrCreate(['agency_id' => $agency->id], [
            'subdomain'       => 'sandton-realty',
            'template'        => 'editorial',
            'status'          => 'published',
            'published_at'    => now(),
            'primary_color'   => '#B8202E',
            'accent_color'    => '#1F2937',
            'hero_image'      => $hero,
            'hero_heading'    => 'Exceptional homes. Personal service.',
            'tagline'         => 'Sandton, Rosebank and Bryanston property — sold, let and managed by people who live here.',
            'about'           => "Sandton Realty is an independent agency serving Johannesburg's northern suburbs.\n\nOur agents specialise in sectional title and freehold homes across Sandton, Rosebank, Bryanston and Fourways, and we manage a growing rental portfolio for local landlords.\n\nEvery listing is handled personally from valuation to transfer — no call centres, no hand-offs.",
            'social_links'    => ['facebook' => 'https://facebook.com/', 'instagram' => 'https://instagram.com/', 'whatsapp' => '082 555 0100'],
            'seo_title'       => 'Sandton Realty | Homes for sale and to rent in Sandton',
            'seo_description' => 'Browse houses and apartments for sale and to rent in Sandton, Rosebank and Bryanston with Sandton Realty.',
            'show_agents'     => true,
        ]);

        $bios = [
            'sipho@sandton-realty.test' => "Sipho has sold and let homes in Sandton and Rosebank for nine years. He specialises in sectional title apartments and first-time buyers, and is known for straight answers on price.",
            'aisha@sandton-realty.test' => "Aisha focuses on family homes in Bryanston and Fourways. Before property she worked in conveyancing, so she guides her sellers through every step from offer to registration.",
        ];
        foreach ($bios as $email => $bio) {
            $user = User::where('email', $email)->first();
            if ($user) {
                AgencyAgent::where('agency_id', $agency->id)->where('user_id', $user->id)->update(['bio' => $bio, 'show_on_website' => true]);
            }
        }

        $this->command?->info('Sandton Realty website published at sandton-realty.'.config('sites.base_domain'));
    }
}
