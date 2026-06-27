<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Safety net for the paywall launch: the subscription_plan / subscription_expires_at
 * columns are declared in the original agencies & landlords table migrations, but if
 * those migrations had already run on a live database before the columns were added,
 * the columns would be missing. This idempotently ensures they exist.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['agencies', 'landlords'] as $tableName) {
            if (! Schema::hasTable($tableName)) {
                continue;
            }
            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                if (! Schema::hasColumn($tableName, 'subscription_plan')) {
                    $table->string('subscription_plan')->nullable();
                }
                if (! Schema::hasColumn($tableName, 'subscription_expires_at')) {
                    $table->timestamp('subscription_expires_at')->nullable();
                }
            });
        }
    }

    public function down(): void
    {
        // No-op: columns may predate this migration; never drop them on rollback.
    }
};
