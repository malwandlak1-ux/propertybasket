<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** The lease created from an approved rental application. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rental_applications', function (Blueprint $t) {
            $t->foreignId('lease_id')->nullable()->after('listing_id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('rental_applications', function (Blueprint $t) {
            $t->dropConstrainedForeignId('lease_id');
        });
    }
};
