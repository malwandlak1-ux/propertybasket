<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Direct bank links (host-to-host) for agencies with a corporate agreement with their bank.
 * The agency requests it, the platform tracks the bank's onboarding, and once live, payout
 * runs drop ISO 20022 payment files on the bank's SFTP server; the bank's status files come back
 * the same way. Starts with FNB.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bank_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->unique()->constrained('agencies')->cascadeOnDelete();
            $table->string('bank', 20)->default('fnb');
            // requested → agreement → credentials → testing → live (or paused)
            $table->string('status', 20)->default('requested');
            $table->string('contact_name', 120)->nullable();
            $table->string('contact_email', 180)->nullable();
            $table->string('contact_phone', 40)->nullable();
            $table->string('banker_name', 120)->nullable();
            $table->string('banker_email', 180)->nullable();
            $table->text('notes')->nullable();
            // Bank-issued codes for the file header / initiating party.
            $table->string('client_code', 40)->nullable();
            // SFTP connection (encrypted secrets).
            $table->string('sftp_host', 190)->nullable();
            $table->unsignedSmallInteger('sftp_port')->default(22);
            $table->string('sftp_username', 120)->nullable();
            $table->text('sftp_password')->nullable();
            $table->text('sftp_private_key')->nullable();
            $table->string('upload_dir', 190)->default('/outbox');
            $table->string('download_dir', 190)->default('/inbox');
            $table->timestamp('requested_at')->nullable();
            $table->timestamp('live_at')->nullable();
            $table->timestamp('last_polled_at')->nullable();
            $table->string('last_error', 300)->nullable();
            $table->timestamps();
        });

        // Audit trail of every file exchanged with the bank.
        Schema::create('bank_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bank_link_id')->constrained('bank_links')->cascadeOnDelete();
            $table->foreignId('payout_batch_id')->nullable()->constrained('payout_batches')->nullOnDelete();
            $table->string('direction', 3); // out | in
            $table->string('name', 190);
            $table->string('message_id', 40)->nullable();
            $table->string('kind', 20)->nullable(); // pain.001 | pain.002 | other
            $table->string('storage_path', 255)->nullable();
            $table->string('summary', 300)->nullable();
            $table->timestamps();
            $table->unique(['bank_link_id', 'direction', 'name']);
        });

        Schema::table('payout_batches', function (Blueprint $table) {
            $table->string('bank_message_id', 40)->nullable()->after('failure_reason');
        });
        Schema::table('commissions', function (Blueprint $table) {
            $table->string('bank_status', 40)->nullable()->after('payment_reference');
        });
    }

    public function down(): void
    {
        Schema::table('commissions', fn (Blueprint $table) => $table->dropColumn('bank_status'));
        Schema::table('payout_batches', fn (Blueprint $table) => $table->dropColumn('bank_message_id'));
        Schema::dropIfExists('bank_files');
        Schema::dropIfExists('bank_links');
    }
};
