<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('leases', 'tenant_signed_at')) {
            return;
        }

        Schema::table('leases', function (Blueprint $table) {
            $table->timestamp('tenant_signed_at')->nullable()->after('signed_at');
            $table->string('tenant_signature')->nullable()->after('tenant_signed_at');
        });
    }

    public function down(): void
    {
        Schema::table('leases', function (Blueprint $table) {
            $table->dropColumn(['tenant_signed_at', 'tenant_signature']);
        });
    }
};
