<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agency_agents', function (Blueprint $table) {
            $table->string('ffc_certificate_path')->nullable()->after('ffc_expires_at');
            $table->timestamp('ffc_reminder_sent_at')->nullable()->after('ffc_certificate_path');
        });
    }

    public function down(): void
    {
        Schema::table('agency_agents', function (Blueprint $table) {
            $table->dropColumn(['ffc_certificate_path', 'ffc_reminder_sent_at']);
        });
    }
};
