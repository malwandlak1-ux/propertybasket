<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Facility operations ledger: a landlord's running costs (kitchen upkeep,
 * rates & taxes, municipal bills, gardening, …) and other income earned by
 * the facility. Deliberately separate from rent and maintenance: nothing
 * here feeds rent, the Finance page or the owner statements.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('facility_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('landlord_id')->constrained()->cascadeOnDelete();
            $table->foreignId('listing_id')->nullable()->constrained('listings')->nullOnDelete(); // null = whole facility
            $table->string('type', 10);            // expense | income
            $table->string('category', 40);
            $table->string('description', 255);
            $table->decimal('amount', 14, 2);
            $table->date('entry_date');
            $table->string('counterparty', 160)->nullable(); // supplier paid / who paid us
            $table->string('reference', 80)->nullable();     // invoice, account or receipt number
            $table->text('notes')->nullable();
            $table->string('attachment_path')->nullable();
            $table->string('attachment_name')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['landlord_id', 'entry_date']);
            $table->index(['landlord_id', 'type', 'category']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('facility_entries');
    }
};
