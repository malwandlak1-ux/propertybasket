<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('landlords', function (Blueprint $table) {
            $table->string('bank_name')->nullable()->after('paystack_customer_code');
            $table->string('bank_account_holder')->nullable()->after('bank_name');
            $table->string('bank_account_number')->nullable()->after('bank_account_holder');
            $table->string('bank_branch_code')->nullable()->after('bank_account_number');
            $table->enum('bank_account_type', ['cheque', 'current', 'savings'])->nullable()->after('bank_branch_code');
            $table->timestamp('bank_verified_at')->nullable()->after('bank_account_type');
            $table->string('paystack_recipient_code')->nullable()->after('bank_verified_at');
        });
    }

    public function down(): void
    {
        Schema::table('landlords', function (Blueprint $table) {
            $table->dropColumn([
                'bank_name', 'bank_account_holder', 'bank_account_number',
                'bank_branch_code', 'bank_account_type', 'bank_verified_at',
                'paystack_recipient_code',
            ]);
        });
    }
};
