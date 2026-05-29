<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contractors', function (Blueprint $table) {
            $table->text('bio')->nullable()->after('trading_name');
            $table->string('bank_name')->nullable()->after('paystack_recipient_code');
            $table->string('bank_account_holder')->nullable()->after('bank_name');
            $table->string('bank_account_number')->nullable()->after('bank_account_holder');
            $table->string('bank_branch_code')->nullable()->after('bank_account_number');
            $table->enum('bank_account_type', ['cheque', 'current', 'savings'])->nullable()->after('bank_branch_code');
            $table->timestamp('bank_verified_at')->nullable()->after('bank_account_type');
        });
    }

    public function down(): void
    {
        Schema::table('contractors', function (Blueprint $table) {
            $table->dropColumn([
                'bio',
                'bank_name', 'bank_account_holder', 'bank_account_number',
                'bank_branch_code', 'bank_account_type', 'bank_verified_at',
            ]);
        });
    }
};
