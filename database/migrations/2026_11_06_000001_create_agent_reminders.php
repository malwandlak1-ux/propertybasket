<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // An agent's own calendar reminders (call back, follow up, renew …),
        // shown on /agent/viewings next to viewings. notified_at is set once the
        // bell notification has gone out, so reminders:send is idempotent.
        Schema::create('agent_reminders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agent_id')->constrained('users')->cascadeOnDelete();
            $table->string('title', 160);
            $table->text('notes')->nullable();
            $table->dateTime('remind_at')->index();
            $table->timestamp('notified_at')->nullable();
            $table->timestamp('done_at')->nullable();
            $table->timestamps();

            $table->index(['agent_id', 'remind_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_reminders');
    }
};
