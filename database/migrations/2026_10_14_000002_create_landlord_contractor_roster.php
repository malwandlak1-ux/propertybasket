<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Contractors a landlord invited themselves stay off the agency marketplace.
        Schema::table('contractors', function (Blueprint $table) {
            $table->foreignId('created_by_landlord_id')->nullable()->after('created_by_agency_id')
                ->constrained('landlords')->nullOnDelete();
        });

        // A landlord's own contractor roster (who they can request quotes from).
        Schema::create('landlord_contractor', function (Blueprint $table) {
            $table->id();
            $table->foreignId('landlord_id')->constrained('landlords')->cascadeOnDelete();
            $table->foreignId('contractor_id')->constrained('contractors')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['landlord_id', 'contractor_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('landlord_contractor');
        Schema::table('contractors', function (Blueprint $table) {
            $table->dropConstrainedForeignId('created_by_landlord_id');
        });
    }
};
