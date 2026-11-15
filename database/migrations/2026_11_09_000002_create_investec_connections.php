<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * An agency's link to its Investec (Private Bank API) trust account, so commission
 * payouts are paid straight from the bank: one click → Investec pays the agents'
 * beneficiaries. Credentials are the agency's own API keys, stored encrypted.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('investec_connections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->unique()->constrained('agencies')->cascadeOnDelete();
            $table->string('environment', 12)->default('production'); // production | sandbox
            $table->text('client_id');
            $table->text('client_secret');
            $table->text('api_key');
            $table->string('account_id', 64);
            $table->string('account_number', 32);
            $table->string('account_name', 120)->nullable();
            $table->timestamp('connected_at')->nullable();
            $table->timestamp('last_checked_at')->nullable();
            $table->string('last_error', 300)->nullable();
            $table->timestamps();
        });
        Schema::table('commissions', function (Blueprint $table) {
            $table->string('payment_reference', 80)->nullable()->after('paystack_transfer_id');
        });
        Schema::table('payout_batches', function (Blueprint $table) {
            $table->string('failure_reason', 300)->nullable()->after('paid_at');
        });
    }

    public function down(): void
    {
        Schema::table('payout_batches', fn (Blueprint $table) => $table->dropColumn('failure_reason'));
        Schema::table('commissions', fn (Blueprint $table) => $table->dropColumn('payment_reference'));
        Schema::dropIfExists('investec_connections');
    }
};
