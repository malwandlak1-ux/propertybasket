<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Browsers/devices that receive web-push alerts while the site is closed. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('push_subscriptions', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->text('endpoint');
            $t->char('endpoint_hash', 64)->unique();
            $t->string('p256dh', 200);
            $t->string('auth', 100);
            $t->string('user_agent', 255)->nullable();
            $t->timestamp('last_used_at')->nullable();
            $t->timestamps();
            $t->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('push_subscriptions');
    }
};
