<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Self-service rental applications: an agent sends a link, the prospect applies online. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rental_applications', function (Blueprint $t) {
            $t->id();
            $t->string('token', 48)->unique();
            $t->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $t->foreignId('listing_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignId('agent_id')->nullable()->constrained('users')->nullOnDelete(); // who handles it
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->string('status', 16)->default('invited'); // invited | in_progress | submitted | reviewing | approved | declined
            $t->string('invitee_name')->nullable();
            $t->string('invitee_email')->nullable();
            $t->string('invitee_phone', 40)->nullable();
            $t->string('employment_type', 16)->nullable(); // salary | self_employed
            $t->json('data')->nullable();
            $t->unsignedTinyInteger('step')->default(0);
            $t->timestamp('opened_at')->nullable();
            $t->timestamp('submitted_at')->nullable();
            $t->string('consent_ip', 45)->nullable();
            $t->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('decided_at')->nullable();
            $t->string('decision_note', 1000)->nullable();
            $t->timestamps();

            $t->index(['agency_id', 'status']);
        });

        Schema::create('rental_application_documents', function (Blueprint $t) {
            $t->id();
            $t->foreignId('rental_application_id')->constrained()->cascadeOnDelete();
            $t->string('kind', 32);
            $t->string('path');
            $t->string('original_name');
            $t->string('mime', 120)->nullable();
            $t->unsignedInteger('size')->default(0);
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rental_application_documents');
        Schema::dropIfExists('rental_applications');
    }
};
