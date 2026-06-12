<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('agencies', 'sale_commission_percent')) {
            return;
        }

        Schema::table('agencies', function (Blueprint $table) {
            $table->decimal('sale_commission_percent', 5, 2)->default(6.00)->after('vat_rate');
            $table->decimal('rental_commission_percent', 5, 2)->default(7.50)->after('sale_commission_percent');
        });
    }

    public function down(): void
    {
        Schema::table('agencies', function (Blueprint $table) {
            $table->dropColumn(['sale_commission_percent', 'rental_commission_percent']);
        });
    }
};
