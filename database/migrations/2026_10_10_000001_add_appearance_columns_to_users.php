<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-user dashboard appearance: accent colour (Settings → Appearance) and an
 * optional uploaded logo that replaces the Property Basket mark in the
 * dashboard sidebar. Agents with no logo of their own inherit their agency
 * owner's (see HandleInertiaRequests::appearance()).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'theme_accent')) {
                $table->string('theme_accent', 16)->nullable();
            }
            if (! Schema::hasColumn('users', 'dashboard_logo')) {
                $table->string('dashboard_logo')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['theme_accent', 'dashboard_logo']);
        });
    }
};
