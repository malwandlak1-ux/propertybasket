<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Link a rental listing to a managed landlord and capture the per-property
 * commission split (landlord / agency / agent — sums to 100% of the rent).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('listings', function (Blueprint $table) {
            if (! Schema::hasColumn('listings', 'managed_landlord_id')) {
                $table->unsignedBigInteger('managed_landlord_id')->nullable()->after('agent_id')->index();
            }
            if (! Schema::hasColumn('listings', 'landlord_split_percent')) {
                $table->decimal('landlord_split_percent', 5, 2)->nullable();
            }
            if (! Schema::hasColumn('listings', 'agency_split_percent')) {
                $table->decimal('agency_split_percent', 5, 2)->nullable();
            }
            if (! Schema::hasColumn('listings', 'agent_split_percent')) {
                $table->decimal('agent_split_percent', 5, 2)->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('listings', function (Blueprint $table) {
            foreach (['managed_landlord_id', 'landlord_split_percent', 'agency_split_percent', 'agent_split_percent'] as $col) {
                if (Schema::hasColumn('listings', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
