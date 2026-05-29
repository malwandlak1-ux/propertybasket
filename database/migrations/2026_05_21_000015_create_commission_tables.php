<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payout_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->constrained('agencies')->cascadeOnDelete();
            $table->date('batch_date');
            $table->decimal('total_gross', 14, 2)->default(0);
            $table->decimal('total_vat', 14, 2)->default(0);
            $table->decimal('total_agent_net', 14, 2)->default(0);
            $table->string('paystack_bulk_transfer_id')->nullable();
            $table->enum('status', ['pending', 'approved', 'processing', 'completed', 'failed'])
                ->default('pending')
                ->index();
            $table->timestamps();
        });

        Schema::create('commissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->constrained('agencies')->cascadeOnDelete();
            $table->foreignId('agent_id')->constrained('users')->cascadeOnDelete();
            $table->enum('deal_type', ['sale', 'rental'])->index();
            $table->foreignId('listing_id')->nullable()->constrained('listings')->nullOnDelete();
            $table->foreignId('lease_id')->nullable()->constrained('leases')->nullOnDelete();
            $table->decimal('deal_value', 14, 2);
            $table->decimal('gross_commission', 14, 2);
            $table->decimal('agent_split_percent', 5, 2);
            $table->decimal('agent_amount', 14, 2);
            $table->decimal('agency_amount', 14, 2);
            $table->decimal('vat_amount', 14, 2)->default(0);
            $table->decimal('agent_net', 14, 2);
            $table->string('paystack_transfer_id')->nullable();
            $table->enum('status', ['pending', 'approved', 'blocked', 'paid'])
                ->default('pending')
                ->index();
            $table->string('blocked_reason')->nullable();
            $table->foreignId('payout_batch_id')->nullable()->constrained('payout_batches')->nullOnDelete();
            $table->date('payout_batch_date')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commissions');
        Schema::dropIfExists('payout_batches');
    }
};
