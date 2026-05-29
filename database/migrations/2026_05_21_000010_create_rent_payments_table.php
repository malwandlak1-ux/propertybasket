<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rent_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lease_id')->constrained('leases')->cascadeOnDelete();
            $table->decimal('amount', 12, 2);
            $table->string('period_month', 7); // YYYY-MM
            $table->date('due_date')->index();
            $table->timestamp('paid_at')->nullable();
            $table->enum('payment_method', ['paystack_card', 'paystack_eft', 'debit_order', 'manual'])
                ->nullable();
            $table->string('paystack_reference')->nullable();
            $table->string('paystack_transaction_id')->nullable();
            $table->enum('status', ['pending', 'paid', 'overdue', 'partial'])
                ->default('pending')
                ->index();
            $table->string('receipt_path')->nullable();
            $table->timestamps();

            $table->unique(['lease_id', 'period_month']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rent_payments');
    }
};
