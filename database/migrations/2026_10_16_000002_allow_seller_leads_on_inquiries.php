<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Seller leads from the CRM's farming tracker enter the pipeline before any
 * listing exists, and owners often have no email on record. So an inquiry's
 * listing and email become optional, it can carry its own estimated deal
 * value, and 'farming' joins the source list.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inquiries', function (Blueprint $table) {
            $table->unsignedBigInteger('listing_id')->nullable()->change();
            $table->string('email')->nullable()->change();
            $table->decimal('deal_value', 14, 2)->nullable()->after('message');
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement(
                "ALTER TABLE inquiries MODIFY COLUMN source "
                . "ENUM('website','property24','private_property','referral','walkin','agent_manual','farming') "
                . "NOT NULL DEFAULT 'website'"
            );
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("UPDATE inquiries SET source = 'agent_manual' WHERE source = 'farming'");
            DB::statement(
                "ALTER TABLE inquiries MODIFY COLUMN source "
                . "ENUM('website','property24','private_property','referral','walkin','agent_manual') "
                . "NOT NULL DEFAULT 'website'"
            );
        }

        Schema::table('inquiries', function (Blueprint $table) {
            $table->dropColumn('deal_value');
        });
    }
};
