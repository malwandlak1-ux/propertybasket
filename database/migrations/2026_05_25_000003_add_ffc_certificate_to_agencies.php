<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agencies', function (Blueprint $table) {
            $table->date('eaab_ffc_expires_at')->nullable()->after('eaab_ffc_number');
            $table->string('eaab_ffc_certificate_path')->nullable()->after('eaab_ffc_expires_at');
            $table->timestamp('eaab_reminder_sent_at')->nullable()->after('eaab_ffc_certificate_path');
        });
    }

    public function down(): void
    {
        Schema::table('agencies', function (Blueprint $table) {
            $table->dropColumn(['eaab_ffc_expires_at', 'eaab_ffc_certificate_path', 'eaab_reminder_sent_at']);
        });
    }
};
