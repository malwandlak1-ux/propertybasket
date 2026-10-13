<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Per-lease late-payment penalty, as agreed in the lease contract.
        Schema::table('leases', function (Blueprint $table) {
            $table->boolean('late_fee_enabled')->default(false)->after('notice_period_days');
            $table->string('late_fee_type', 10)->default('percent')->after('late_fee_enabled'); // percent | fixed
            $table->decimal('late_fee_value', 10, 2)->default(0)->after('late_fee_type');
            $table->unsignedTinyInteger('late_fee_day')->default(7)->after('late_fee_value'); // rent must be paid by this day
            $table->date('late_fee_since')->nullable()->after('late_fee_day');
        });

        // The penalty is added onto the month's charge; `late_fee` keeps the breakdown.
        Schema::table('rent_payments', function (Blueprint $table) {
            $table->decimal('late_fee', 10, 2)->default(0)->after('amount');
            $table->timestamp('late_fee_applied_at')->nullable()->after('late_fee');
            $table->timestamp('late_fee_waived_at')->nullable()->after('late_fee_applied_at');
        });
    }

    public function down(): void
    {
        Schema::table('rent_payments', function (Blueprint $table) {
            $table->dropColumn(['late_fee', 'late_fee_applied_at', 'late_fee_waived_at']);
        });
        Schema::table('leases', function (Blueprint $table) {
            $table->dropColumn(['late_fee_enabled', 'late_fee_type', 'late_fee_value', 'late_fee_day', 'late_fee_since']);
        });
    }
};
