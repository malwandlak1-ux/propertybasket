<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contractors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('business_name');
            $table->string('trading_name')->nullable();
            $table->json('specialities')->nullable();
            $table->json('service_areas')->nullable();
            $table->boolean('vat_registered')->default(false);
            $table->string('vat_number')->nullable();
            $table->string('paystack_recipient_code')->nullable();

            $table->string('cipc_number')->nullable();
            $table->timestamp('cipc_verified_at')->nullable();
            $table->string('tax_clearance_path')->nullable();
            $table->timestamp('tax_clearance_verified_at')->nullable();
            $table->string('bbbee_level')->nullable();
            $table->string('bbbee_path')->nullable();
            $table->timestamp('bbbee_verified_at')->nullable();
            $table->decimal('insurance_amount', 12, 2)->nullable();
            $table->string('insurance_path')->nullable();
            $table->timestamp('insurance_verified_at')->nullable();

            $table->json('certifications')->nullable();
            $table->json('portfolio_items')->nullable();

            $table->decimal('average_rating', 3, 2)->default(0);
            $table->unsignedInteger('total_reviews')->default(0);
            $table->unsignedInteger('total_jobs')->default(0);

            $table->enum('status', ['pending', 'active', 'suspended'])->default('pending')->index();
            $table->decimal('platform_fee_percent', 5, 2)->default(2.50);

            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('contractor_ratings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contractor_id')->constrained('contractors')->cascadeOnDelete();
            $table->foreignId('rated_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('maintenance_request_id')->nullable(); // FK added later
            $table->unsignedTinyInteger('rating');
            $table->text('comment')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contractor_ratings');
        Schema::dropIfExists('contractors');
    }
};
