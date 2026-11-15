<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Agency Documentation: the agency's current lease agreement and listing
 * packs (versioned), plus the audit trail when a tenant signs the lease.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agency_documents', function (Blueprint $t) {
            $t->id();
            $t->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $t->string('category', 32); // lease_agreement | rental_pack | sale_pack
            $t->unsignedInteger('version')->default(1);
            $t->boolean('is_current')->default(true);
            $t->string('path');
            $t->string('original_name');
            $t->string('mime', 160)->nullable();
            $t->unsignedBigInteger('size')->default(0);
            $t->string('sha256', 64)->nullable();
            $t->string('notes', 500)->nullable();
            $t->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();

            $t->index(['agency_id', 'category', 'is_current']);
        });

        Schema::table('agencies', function (Blueprint $t) {
            $t->string('documents_share_token', 40)->nullable()->unique();
        });

        Schema::table('leases', function (Blueprint $t) {
            $t->foreignId('agency_document_id')->nullable()->constrained('agency_documents')->nullOnDelete();
            $t->string('tenant_signed_ip', 45)->nullable();
            $t->string('tenant_signed_user_agent', 300)->nullable();
            $t->string('signed_document_sha256', 64)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('leases', function (Blueprint $t) {
            $t->dropConstrainedForeignId('agency_document_id');
            $t->dropColumn(['tenant_signed_ip', 'tenant_signed_user_agent', 'signed_document_sha256']);
        });
        Schema::table('agencies', function (Blueprint $t) {
            $t->dropUnique(['documents_share_token']);
            $t->dropColumn('documents_share_token');
        });
        Schema::dropIfExists('agency_documents');
    }
};
