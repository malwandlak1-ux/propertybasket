<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('maintenance_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('property_id')->constrained('listings')->cascadeOnDelete();
            $table->foreignId('lease_id')->nullable()->constrained('leases')->nullOnDelete();
            $table->foreignId('submitted_by')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->text('description');
            $table->enum('category', ['plumbing', 'electrical', 'appliances', 'structural', 'garden', 'other']);
            $table->enum('urgency', ['low', 'medium', 'high', 'emergency'])->index();
            $table->date('preferred_date')->nullable();
            $table->string('preferred_time_slot')->nullable();
            $table->json('photos')->nullable();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('status', ['open', 'awaiting_quotes', 'in_progress', 'completed', 'paid'])
                ->default('open')
                ->index();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('maintenance_quotes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('maintenance_request_id')->constrained('maintenance_requests')->cascadeOnDelete();
            $table->foreignId('contractor_id')->constrained('contractors')->cascadeOnDelete();
            $table->json('line_items');
            $table->decimal('subtotal', 12, 2);
            $table->decimal('vat_amount', 12, 2)->default(0);
            $table->decimal('total', 12, 2);
            $table->boolean('vat_registered')->default(false);
            $table->text('notes')->nullable();
            $table->date('valid_until')->nullable();
            $table->enum('status', ['draft', 'sent', 'accepted', 'rejected', 'expired'])
                ->default('draft')
                ->index();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });

        Schema::create('maintenance_invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('maintenance_request_id')->constrained('maintenance_requests')->cascadeOnDelete();
            $table->foreignId('quote_id')->nullable()->constrained('maintenance_quotes')->nullOnDelete();
            $table->foreignId('contractor_id')->constrained('contractors')->cascadeOnDelete();
            $table->json('line_items');
            $table->decimal('original_quote_total', 12, 2)->nullable();
            $table->decimal('invoice_subtotal', 12, 2);
            $table->decimal('vat_amount', 12, 2)->default(0);
            $table->decimal('invoice_total', 12, 2);
            $table->decimal('deviation_amount', 12, 2)->default(0);
            $table->text('deviation_notes')->nullable();
            $table->json('completion_photos')->nullable();
            $table->json('supporting_documents')->nullable();
            $table->string('paystack_reference')->nullable();
            $table->enum('status', ['draft', 'submitted', 'approved', 'paid', 'disputed'])
                ->default('draft')
                ->index();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
        });

        // Backfill the contractor_ratings FK to maintenance_requests
        Schema::table('contractor_ratings', function (Blueprint $table) {
            $table->foreign('maintenance_request_id')
                ->references('id')
                ->on('maintenance_requests')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('contractor_ratings', function (Blueprint $table) {
            $table->dropForeign(['maintenance_request_id']);
        });
        Schema::dropIfExists('maintenance_invoices');
        Schema::dropIfExists('maintenance_quotes');
        Schema::dropIfExists('maintenance_requests');
    }
};
