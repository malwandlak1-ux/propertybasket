<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inquiries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('listing_id')->constrained('listings')->cascadeOnDelete();
            $table->foreignId('listing_unit_id')->nullable()->constrained('listing_units')->nullOnDelete();

            $table->string('name');
            $table->string('email');
            $table->string('phone')->nullable();
            $table->text('message')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();

            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('source', ['website', 'property24', 'private_property', 'referral', 'walkin'])
                ->default('website');
            $table->enum('status', ['new', 'contacted', 'qualified', 'viewing', 'offer', 'closed', 'lost'])
                ->default('new')
                ->index();

            $table->timestamp('allocated_at')->nullable();
            $table->enum('allocation_method', ['round_robin', 'manual'])->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inquiries');
    }
};
