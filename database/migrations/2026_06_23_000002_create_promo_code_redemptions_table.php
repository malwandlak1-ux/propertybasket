<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promo_code_redemptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('promo_code_id')->constrained('promo_codes')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->morphs('subscriber'); // the Agency / Landlord that got the access
            $table->timestamp('access_expires_at');
            $table->timestamps();

            // A given code can only be redeemed once per user — once their access
            // window lapses they cannot reuse the same code to get back in.
            $table->unique(['promo_code_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promo_code_redemptions');
    }
};
