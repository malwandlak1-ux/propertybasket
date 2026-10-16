<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Loads the shared farming reference data (Pretoria regions + Lightstone
 * suburb stats) from database/seeders/data/crm_reference.json. Runs as a migration so
 * every environment gets it on deploy. Contains no owner/personal data.
 * Idempotent: skips regions that already exist.
 */
return new class extends Migration
{
    public function up(): void
    {
        $path = database_path('seeders/data/crm_reference.json');
        if (! is_file($path)) {
            return;
        }

        $data = json_decode(file_get_contents($path), true);
        $now  = now();

        foreach ($data['regions'] ?? [] as $region) {
            if (DB::table('crm_regions')->whereNull('agency_id')->where('slug', $region['slug'])->exists()) {
                continue;
            }

            $regionId = DB::table('crm_regions')->insertGetId([
                'agency_id'  => null,
                'slug'       => $region['slug'],
                'name'       => $region['name'],
                'sort'       => $region['sort'] ?? 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $rows = array_map(fn ($s) => [
                'crm_region_id' => $regionId,
                'agency_id'     => null,
                'name'          => $s['name'],
                'municipality'  => $s['municipality'] ?? null,
                'signal'        => $s['signal'] ?? null,
                'angle'         => $s['angle'] ?? null,
                'priority'      => $s['priority'] ?? null,
                'stats'         => isset($s['stats']) ? json_encode($s['stats']) : null,
                'created_at'    => $now,
                'updated_at'    => $now,
            ], $region['suburbs'] ?? []);

            foreach (array_chunk($rows, 50) as $chunk) {
                DB::table('crm_suburbs')->insert($chunk);
            }
        }
    }

    public function down(): void
    {
        DB::table('crm_regions')->whereNull('agency_id')->delete();
    }
};
