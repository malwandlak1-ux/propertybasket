<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** An agent's library of catalogues/brochures to send in WhatsApp chats. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wa_catalogues', function (Blueprint $t) {
            $t->id();
            $t->foreignId('agent_id')->constrained('users')->cascadeOnDelete();
            $t->string('title', 120);
            $t->string('description', 500)->nullable();
            $t->string('path');
            $t->string('original_name', 200);
            $t->string('mime', 100);
            $t->unsignedBigInteger('size');
            $t->unsignedInteger('sent_count')->default(0);
            $t->timestamp('last_sent_at')->nullable();
            $t->timestamps();
            $t->index(['agent_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wa_catalogues');
    }
};
