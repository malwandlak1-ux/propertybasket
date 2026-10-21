<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-number sending hours. They can only narrow the platform's CPA-compliant
 * schedule (config whatsapp.schedule); null = use the full platform window.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('whatsapp_accounts', function (Blueprint $table) {
            $table->string('send_from', 5)->nullable()->after('messaging_limit');
            $table->string('send_until', 5)->nullable()->after('send_from');
            $table->boolean('send_saturdays')->default(true)->after('send_until');
        });
    }

    public function down(): void
    {
        Schema::table('whatsapp_accounts', function (Blueprint $table) {
            $table->dropColumn(['send_from', 'send_until', 'send_saturdays']);
        });
    }
};
