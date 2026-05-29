<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contractors', function (Blueprint $table) {
            $table->foreignId('created_by_agency_id')
                ->nullable()
                ->after('user_id')
                ->constrained('agencies')
                ->nullOnDelete()
                ->index();
        });
    }

    public function down(): void
    {
        Schema::table('contractors', function (Blueprint $table) {
            $table->dropConstrainedForeignId('created_by_agency_id');
        });
    }
};
