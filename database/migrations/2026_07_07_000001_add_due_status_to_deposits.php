<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Broaden the deposit status set so a deposit can be raised as "due"
        // (owed by the tenant, not yet received into the trust account) and
        // only becomes "held" once the agency marks it received.
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE deposits MODIFY status ENUM('due','held','partially_refunded','refunded') NOT NULL DEFAULT 'due'");
        } else {
            // SQLite/others: enums are stored as strings — swap to a plain
            // varchar so the new 'due' value is accepted.
            Schema::table('deposits', function (Blueprint $table) {
                $table->string('status')->default('due')->change();
            });
        }

        Schema::table('deposits', function (Blueprint $table) {
            if (! Schema::hasColumn('deposits', 'marked_received_by')) {
                $table->foreignId('marked_received_by')
                    ->nullable()
                    ->after('status')
                    ->constrained('users')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('deposits', function (Blueprint $table) {
            if (Schema::hasColumn('deposits', 'marked_received_by')) {
                $table->dropConstrainedForeignId('marked_received_by');
            }
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE deposits MODIFY status ENUM('held','partially_refunded','refunded') NOT NULL DEFAULT 'held'");
        } else {
            Schema::table('deposits', function (Blueprint $table) {
                $table->string('status')->default('held')->change();
            });
        }
    }
};
