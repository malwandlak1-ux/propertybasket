<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-section image overrides for agency websites:
 * { about, cta, why, types: { house: url, … }, areas: { "Sandton": url, … } }.
 * The hero keeps its own hero_image column. Any slot left empty falls back
 * to an automatic photo (hero image or a listing photo).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agency_websites', function (Blueprint $table) {
            $table->json('images')->nullable()->after('hero_image');
        });
    }

    public function down(): void
    {
        Schema::table('agency_websites', function (Blueprint $table) {
            $table->dropColumn('images');
        });
    }
};
