<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Convenience wrapper that seeds every PlusGroup-sourced listing in one call.
 *
 * Prod (attach all to one agency owner):
 *   PLUSGROUP_OWNER_EMAIL=info@propertybasket.co.za \
 *     php artisan db:seed --class=PlusGroupListingsSeeder --force
 *
 * It forwards PLUSGROUP_OWNER_EMAIL to each listing seeder's own
 * *_OWNER_EMAIL variable, so every listing lands under the same agency.
 * Local: run with no env var to attach them all to the Sandton Realty demo.
 *
 * Each child seeder is idempotent (keyed on slug), so re-running is safe.
 */
class PlusGroupListingsSeeder extends Seeder
{
    /** Child seeders and the env var each one reads for its owner email. */
    private const SEEDERS = [
        LeanderIqListingSeeder::class          => 'LEANDER_OWNER_EMAIL',
        BlueVistaListingSeeder::class          => 'BLUEVISTA_OWNER_EMAIL',
        GlenAcresListingSeeder::class          => 'GLENACRES_OWNER_EMAIL',
        EtudeListingSeeder::class              => 'ETUDE_OWNER_EMAIL',
        BushwillowLivingListingSeeder::class   => 'BUSHWILLOW_OWNER_EMAIL',
        RheenendalLivingListingSeeder::class   => 'RHEENENDAL_OWNER_EMAIL',
        JusticeCourtListingSeeder::class       => 'JUSTICE_OWNER_EMAIL',
        RoyalSkyListingSeeder::class           => 'ROYALSKY_OWNER_EMAIL',
        ZomerlustLivingListingSeeder::class    => 'ZOMERLUST_OWNER_EMAIL',
        RondeboschListingSeeder::class         => 'RONDEBOSCH_OWNER_EMAIL',
        ArvadaIqListingSeeder::class           => 'ARVADA_OWNER_EMAIL',
        PaperbarkEstateListingSeeder::class    => 'PAPERBARK_OWNER_EMAIL',
        Brooklyn160ListingSeeder::class        => 'BROOKLYN_OWNER_EMAIL',
        HornbillCornerListingSeeder::class     => 'HORNBILL_OWNER_EMAIL',
        MeerendalLivingListingSeeder::class    => 'MEERENDAL_OWNER_EMAIL',
    ];

    public function run(): void
    {
        $shared = getenv('PLUSGROUP_OWNER_EMAIL') ?: null;

        foreach (self::SEEDERS as $class => $envVar) {
            // Only set the child's var when a shared email is given AND the
            // child's own var isn't already explicitly set — so per-listing
            // overrides still win.
            if ($shared && ! getenv($envVar)) {
                putenv("{$envVar}={$shared}");
            }

            $this->call($class);
        }

        $this->command?->info('All PlusGroup listings seeded (' . count(self::SEEDERS) . ' listings).');
    }
}
