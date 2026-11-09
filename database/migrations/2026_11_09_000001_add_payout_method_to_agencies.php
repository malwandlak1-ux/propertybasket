<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * How an agency pays its agents' commission:
 *   paystack       — automated transfers through Paystack
 *   trust_account  — EFT from the agency's own (verified) trust account: the platform
 *                    prepares a bank bulk-payment file and the agency marks the batch paid.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agencies', function (Blueprint $table) {
            $table->string('payout_method', 20)->default('paystack')->after('payout_day');
        });
        Schema::table('payout_batches', function (Blueprint $table) {
            $table->string('method', 20)->nullable()->after('status');
            $table->string('paid_reference', 80)->nullable()->after('method');
            $table->timestamp('paid_at')->nullable()->after('paid_reference');
        });
    }

    public function down(): void
    {
        Schema::table('payout_batches', fn (Blueprint $table) => $table->dropColumn(['method', 'paid_reference', 'paid_at']));
        Schema::table('agencies', fn (Blueprint $table) => $table->dropColumn('payout_method'));
    }
};
