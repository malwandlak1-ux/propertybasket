<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // SQLite (tests) doesn't enforce enums — only MySQL needs the ALTER.
        if (DB::getDriverName() !== 'mysql') {
            return;
        }
        DB::statement(
            "ALTER TABLE inquiries MODIFY COLUMN status "
            . "ENUM('new','contacted','qualified','viewing','offer','closed','registered','lost') "
            . "NOT NULL DEFAULT 'new'"
        );
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }
        DB::statement(
            "ALTER TABLE inquiries MODIFY COLUMN status "
            . "ENUM('new','contacted','qualified','viewing','offer','closed','lost') "
            . "NOT NULL DEFAULT 'new'"
        );
    }
};
