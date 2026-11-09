<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** A user's own mailbox (POP3/IMAP in, SMTP out), shown under Messages → Email. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_accounts', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $t->string('email');
            $t->string('display_name')->nullable();
            $t->string('protocol', 8)->default('pop3'); // pop3 | imap
            $t->string('incoming_host');
            $t->unsignedSmallInteger('incoming_port');
            $t->string('incoming_encryption', 8)->default('ssl'); // ssl | tls | none
            $t->string('username');
            $t->text('password'); // encrypted cast
            $t->string('smtp_host');
            $t->unsignedSmallInteger('smtp_port');
            $t->string('smtp_encryption', 8)->default('ssl');
            $t->string('smtp_username')->nullable(); // null = same as incoming
            $t->text('smtp_password')->nullable();
            $t->timestamp('last_synced_at')->nullable();
            $t->string('last_error', 500)->nullable();
            $t->timestamps();
        });

        Schema::create('email_messages', function (Blueprint $t) {
            $t->id();
            $t->foreignId('email_account_id')->constrained()->cascadeOnDelete();
            $t->string('folder', 8)->default('inbox'); // inbox | sent
            $t->string('uid', 64);
            $t->string('message_id')->nullable();
            $t->string('in_reply_to')->nullable();
            $t->string('from_email')->nullable();
            $t->string('from_name')->nullable();
            $t->json('to')->nullable();
            $t->json('cc')->nullable();
            $t->string('subject', 500)->nullable();
            $t->longText('body_text')->nullable();
            $t->longText('body_html')->nullable();
            $t->json('attachments')->nullable(); // [{name, size}] — names only
            $t->timestamp('received_at')->nullable();
            $t->timestamp('read_at')->nullable();
            $t->timestamps();

            $t->unique(['email_account_id', 'folder', 'uid']);
            $t->index(['email_account_id', 'folder', 'received_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_messages');
        Schema::dropIfExists('email_accounts');
    }
};
