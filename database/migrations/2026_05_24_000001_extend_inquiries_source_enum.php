<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // SQLite (tests) doesn't enforce enums — only MySQL needs the ALTER.
        if (DB::getDriverName() !== 'mysql') {
            return;
        }
        DB::statement(
            "ALTER TABLE inquiries MODIFY COLUMN source "
            . "ENUM('website','property24','private_property','referral','walkin','agent_manual') "
            . "NOT NULL DEFAULT 'website'"
        );
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }
        DB::statement(
            "ALTER TABLE inquiries MODIFY COLUMN source "
            . "ENUM('website','property24','private_property','referral','walkin') "
            . "NOT NULL DEFAULT 'website'"
        );
    }
};
