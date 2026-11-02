<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Meta's media id for a photo/document/voice note an owner sent us. The file is
 * downloaded from Meta (ids live ~30 days) into media_path for the chat to show.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wa_messages', function (Blueprint $table) {
            $table->string('wa_media_id', 64)->nullable()->after('media_mime');
        });
    }

    public function down(): void
    {
        Schema::table('wa_messages', function (Blueprint $table) {
            $table->dropColumn('wa_media_id');
        });
    }
};
