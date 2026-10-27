<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Attachments on WhatsApp replies: a private copy so the chat can show what was sent. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wa_messages', function (Blueprint $table) {
            $table->string('media_path', 255)->nullable()->after('body');
            $table->string('media_name', 255)->nullable()->after('media_path');
            $table->string('media_mime', 120)->nullable()->after('media_name');
        });
    }

    public function down(): void
    {
        Schema::table('wa_messages', function (Blueprint $table) {
            $table->dropColumn(['media_path', 'media_name', 'media_mime']);
        });
    }
};
