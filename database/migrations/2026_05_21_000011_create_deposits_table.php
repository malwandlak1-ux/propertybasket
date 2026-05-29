<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('deposits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lease_id')->constrained('leases')->cascadeOnDelete();
            $table->decimal('amount_deposited', 12, 2)->default(0);
            $table->timestamp('deposited_at')->nullable();
            $table->decimal('interest_rate', 5, 2)->default(6.75);
            $table->decimal('accrued_interest', 12, 2)->default(0);
            $table->date('last_accrual_date')->nullable();
            $table->json('deductions')->nullable();
            $table->decimal('refund_amount', 12, 2)->nullable();
            $table->timestamp('refunded_at')->nullable();
            $table->string('paystack_reference')->nullable();
            $table->enum('status', ['held', 'partially_refunded', 'refunded'])->default('held')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deposits');
    }
};
