<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // First rent charge a mandate may collect (due on/after this date), kept
        // when the tenant later changes bank details or debit day.
        Schema::table('debit_orders', function (Blueprint $table) {
            $table->date('collect_from')->nullable()->after('debit_day');
        });

        // One row per collection attempt against a month's rent charge.
        Schema::create('debit_order_collections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('debit_order_id')->constrained('debit_orders')->cascadeOnDelete();
            $table->foreignId('lease_id')->constrained('leases')->cascadeOnDelete();
            $table->foreignId('rent_payment_id')->constrained('rent_payments')->cascadeOnDelete();
            $table->decimal('amount', 12, 2);
            $table->string('reference')->unique();
            $table->string('status', 16)->default('pending')->index(); // pending | succeeded | failed
            $table->string('failure_reason')->nullable();
            $table->timestamp('attempted_at')->nullable();
            $table->timestamp('settled_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('debit_order_collections');
        Schema::table('debit_orders', function (Blueprint $table) {
            $table->dropColumn('collect_from');
        });
    }
};
