<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('debit_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lease_id')->constrained('leases')->cascadeOnDelete();
            $table->foreignId('tenant_id')->constrained('users')->cascadeOnDelete();

            $table->string('bank_name');
            $table->string('account_holder');
            $table->string('account_number');
            $table->string('branch_code');
            $table->enum('account_type', ['cheque', 'current', 'savings'])->default('cheque');

            $table->unsignedTinyInteger('debit_day')->default(1); // 1..28
            $table->enum('status', ['active', 'paused', 'cancelled'])->default('active')->index();

            $table->timestamp('signed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('debit_orders');
    }
};
