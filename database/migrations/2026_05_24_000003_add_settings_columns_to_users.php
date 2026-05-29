<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->json('notification_preferences')->nullable()->after('avatar');
            $table->string('bank_account_holder')->nullable()->after('paystack_customer_code');
            $table->string('bank_account_number', 32)->nullable()->after('bank_account_holder');
            $table->string('bank_code', 16)->nullable()->after('bank_account_number');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['notification_preferences', 'bank_account_holder', 'bank_account_number', 'bank_code']);
        });
    }
};
