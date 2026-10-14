<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The reference the tenant puts on EFT rent payments (from the lease).
        Schema::table('leases', function (Blueprint $table) {
            $table->string('payment_reference', 60)->nullable()->after('late_fee_since');
        });

        // A tenant's "I've paid by EFT" notice, confirmed (or rejected) by
        // whoever manages the lease once the money shows in their account.
        Schema::create('eft_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lease_id')->constrained('leases')->cascadeOnDelete();
            $table->foreignId('rent_payment_id')->constrained('rent_payments')->cascadeOnDelete();
            $table->foreignId('tenant_id')->constrained('users')->cascadeOnDelete();
            $table->decimal('amount', 12, 2);
            $table->date('paid_on');
            $table->string('reference', 80)->nullable();
            $table->string('proof_path')->nullable();
            $table->string('note', 500)->nullable();
            $table->string('status', 16)->default('submitted')->index(); // submitted | confirmed | rejected
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('reject_reason', 300)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('eft_payments');
        Schema::table('leases', function (Blueprint $table) {
            $table->dropColumn('payment_reference');
        });
    }
};
