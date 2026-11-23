<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * An agent can now have one live number plus earlier numbers kept as
 * read-only history (status "archived"), so agent_id is no longer unique.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('whatsapp_accounts', function (Blueprint $t) {
            $t->index('agent_id', 'whatsapp_accounts_agent_id_index'); // keeps the foreign key indexed
        });
        Schema::table('whatsapp_accounts', function (Blueprint $t) {
            $t->dropUnique('whatsapp_accounts_agent_id_unique');
        });
    }

    public function down(): void
    {
        Schema::table('whatsapp_accounts', function (Blueprint $t) {
            $t->unique('agent_id', 'whatsapp_accounts_agent_id_unique');
        });
        Schema::table('whatsapp_accounts', function (Blueprint $t) {
            $t->dropIndex('whatsapp_accounts_agent_id_index');
        });
    }
};
