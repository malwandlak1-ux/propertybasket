<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('listings', function (Blueprint $table) {
            $table->id();
            $table->ulid('ulid')->unique();

            $table->morphs('owner'); // owner_type, owner_id (Agency or Landlord)
            $table->foreignId('agent_id')->nullable()->constrained('users')->nullOnDelete();

            $table->string('title');
            $table->string('slug')->unique();
            $table->text('description')->nullable();

            $table->enum('listing_type', ['for_sale', 'long_term_rent', 'short_term_stay'])->index();
            $table->enum('property_type', [
                'apartment', 'house', 'townhouse', 'commercial', 'land', 'other',
            ])->index();
            $table->enum('status', ['draft', 'available', 'leased', 'sold', 'archived'])
                ->default('draft')
                ->index();

            $table->decimal('sale_price', 14, 2)->nullable();
            $table->boolean('negotiator_protocol')->default(false);

            $table->decimal('monthly_rent', 12, 2)->nullable();
            $table->enum('listing_structure', ['single_unit', 'multi_unit'])->default('single_unit');
            $table->decimal('short_stay_nightly_price', 10, 2)->nullable();
            $table->unsignedSmallInteger('short_stay_max_guests')->nullable();
            $table->decimal('short_stay_cleaning_fee', 10, 2)->nullable();

            $table->string('address')->nullable();
            $table->string('suburb')->nullable()->index();
            $table->string('city')->nullable()->index();
            $table->string('province')->nullable();
            $table->string('postal_code')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();

            $table->unsignedSmallInteger('bedrooms')->nullable();
            $table->decimal('bathrooms', 4, 1)->nullable();
            $table->decimal('area_sqm', 10, 2)->nullable();
            $table->json('amenities')->nullable();

            $table->string('primary_image')->nullable();
            $table->json('gallery_images')->nullable();

            $table->unsignedInteger('views_count')->default(0);
            $table->unsignedInteger('inquiries_count')->default(0);

            $table->enum('deactivated_reason', ['leased', 'sold', 'off_market', 'other'])->nullable();
            $table->timestamp('reactivated_at')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'deleted_at']);
            $table->index(['listing_type', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('listings');
    }
};
