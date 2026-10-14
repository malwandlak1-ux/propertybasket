<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Tenants' own bank account (debit-order source, deposit refunds).
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'bank_name')) {
                $table->string('bank_name', 120)->nullable()->after('bank_account_holder');
            }
            if (! Schema::hasColumn('users', 'bank_account_type')) {
                $table->string('bank_account_type', 16)->nullable()->after('bank_code');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['bank_name', 'bank_account_type']);
        });
    }
};
