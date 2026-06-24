<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promo_codes', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();           // stored uppercase
            $table->string('description')->nullable();
            // Who the code is for. Contractors are excluded from the paywall.
            $table->enum('audience', ['agency', 'landlord', 'both'])->default('both');
            // How long the free-access window lasts once a user redeems the code.
            $table->unsignedSmallInteger('duration_days');
            // Optional global redemption cap across all users.
            $table->unsignedInteger('max_redemptions')->nullable();
            $table->unsignedInteger('times_redeemed')->default(0);
            // Optional last date the code may be redeemed (separate from access length).
            $table->date('valid_until')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promo_codes');
    }
};
