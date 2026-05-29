<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE `conversations` MODIFY COLUMN `type` ENUM(
            'agency_agent', 'landlord_tenant', 'landlord_contractor',
            'agency_tenant', 'agent_lead', 'agent_contractor', 'agency_contractor'
        ) NOT NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE `conversations` MODIFY COLUMN `type` ENUM(
            'agency_agent', 'landlord_tenant', 'landlord_contractor',
            'agency_tenant', 'agent_lead'
        ) NOT NULL");
    }
};
