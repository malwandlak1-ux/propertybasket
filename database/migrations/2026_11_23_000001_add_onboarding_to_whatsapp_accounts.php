<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** How a number was connected: manual (IDs + token), embedded (Meta sign-up) or coexistence (WhatsApp Business app QR scan). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('whatsapp_accounts', function (Blueprint $t) {
            $t->string('onboarding', 20)->default('manual')->after('status');
            $t->timestamp('history_synced_at')->nullable()->after('last_synced_at');
        });
    }

    public function down(): void
    {
        Schema::table('whatsapp_accounts', function (Blueprint $t) {
            $t->dropColumn(['onboarding', 'history_synced_at']);
        });
    }
};
