<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The agent chose to message an owner who already received a WhatsApp from them:
 * the dispatcher skips its repeat-protection check for this message.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wa_messages', function (Blueprint $table) {
            $table->boolean('repeat_ok')->default(false)->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('wa_messages', function (Blueprint $table) {
            $table->dropColumn('repeat_ok');
        });
    }
};
