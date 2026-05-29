<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agency_agents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->constrained('agencies')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();

            $table->decimal('commission_split_percent', 5, 2)->default(70.00);
            $table->json('area_speciality')->nullable();
            $table->json('property_type_speciality')->nullable();
            $table->string('ffc_number')->nullable();
            $table->date('ffc_expires_at')->nullable();
            $table->unsignedInteger('lead_allocation_position')->default(0);
            $table->enum('status', ['active', 'pending', 'suspended'])->default('pending')->index();

            $table->timestamps();
            $table->unique(['agency_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agency_agents');
    }
};
