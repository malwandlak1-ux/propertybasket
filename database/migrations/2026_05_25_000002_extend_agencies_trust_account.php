<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agencies', function (Blueprint $table) {
            $table->string('trust_account_holder')->nullable()->after('trust_branch_code');
            $table->enum('trust_account_type', ['cheque', 'current', 'savings'])->nullable()->after('trust_account_holder');
            $table->string('trust_auditor_name')->nullable()->after('trust_account_type');
            $table->string('trust_auditor_practice_number')->nullable()->after('trust_auditor_name');
            $table->timestamp('trust_verified_at')->nullable()->after('trust_auditor_practice_number');
        });
    }

    public function down(): void
    {
        Schema::table('agencies', function (Blueprint $table) {
            $table->dropColumn([
                'trust_account_holder', 'trust_account_type',
                'trust_auditor_name', 'trust_auditor_practice_number', 'trust_verified_at',
            ]);
        });
    }
};
