<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * WhatsApp Cloud API (Meta) bulk messaging for the CRM. Each agent connects
 * their own WhatsApp Business account and pays Meta directly; we store the
 * credentials encrypted, sync their approved templates, queue campaigns and
 * record every outbound/inbound message plus Meta's delivery statuses.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('whatsapp_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agent_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $table->string('waba_id', 40);
            $table->string('phone_number_id', 40);
            $table->string('display_phone', 40)->nullable();
            $table->string('verified_name', 120)->nullable();
            $table->text('access_token');           // encrypted cast
            $table->text('app_secret')->nullable();  // encrypted cast; verifies webhook signatures
            $table->string('webhook_key', 40)->unique();
            $table->string('verify_token', 64);
            $table->string('quality_rating', 20)->nullable();
            $table->string('messaging_limit', 30)->nullable();
            $table->string('status', 20)->default('connected');
            $table->string('last_error', 500)->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamps();
        });

        Schema::create('wa_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('whatsapp_account_id')->constrained('whatsapp_accounts')->cascadeOnDelete();
            $table->string('meta_id', 40)->nullable();
            $table->string('name', 512);
            $table->string('language', 15);
            $table->string('category', 30)->nullable();
            $table->string('status', 30);
            $table->text('body')->nullable();
            $table->string('header', 255)->nullable();
            $table->string('footer', 255)->nullable();
            $table->json('params')->nullable();       // placeholder names in body order: ["1","2"] or ["owner_name"]
            $table->json('components')->nullable();
            $table->boolean('sendable')->default(true);
            $table->string('unsupported_reason', 255)->nullable();
            $table->timestamps();

            $table->index(['whatsapp_account_id', 'status']);
        });

        Schema::create('wa_campaigns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $table->foreignId('agent_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('whatsapp_account_id')->constrained('whatsapp_accounts')->cascadeOnDelete();
            $table->foreignId('wa_template_id')->nullable()->constrained('wa_templates')->nullOnDelete();
            $table->string('name', 160);
            $table->string('template_name', 512);
            $table->string('template_language', 15);
            $table->json('variable_map')->nullable();
            $table->string('status', 20)->default('queued'); // queued | sending | paused | completed | cancelled
            $table->string('pause_reason', 255)->nullable();
            $table->unsignedInteger('total')->default(0);
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['agent_id', 'status']);
            $table->index(['agency_id', 'created_at']);
        });

        Schema::create('wa_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('whatsapp_account_id')->constrained('whatsapp_accounts')->cascadeOnDelete();
            $table->foreignId('agent_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('wa_campaign_id')->nullable()->constrained('wa_campaigns')->cascadeOnDelete();
            $table->foreignId('crm_prospect_id')->nullable()->constrained('crm_prospects')->nullOnDelete();
            $table->string('direction', 3);           // out | in
            $table->string('type', 20);               // template | text | (inbound type)
            $table->string('phone', 20);              // E.164 digits, no plus
            $table->text('body')->nullable();
            $table->json('variables')->nullable();
            $table->string('wamid', 191)->nullable()->index();
            $table->string('status', 20);             // queued | sent | delivered | read | failed | skipped | received
            $table->string('error_code', 20)->nullable();
            $table->string('error_message', 500)->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->timestamp('replied_at')->nullable();
            $table->timestamps();

            $table->index(['whatsapp_account_id', 'phone']);
            $table->index(['wa_campaign_id', 'status']);
        });

        Schema::table('crm_prospects', function (Blueprint $table) {
            $table->timestamp('wa_opt_in_at')->nullable()->after('inquiry_id');
            $table->string('wa_opt_in_source', 40)->nullable()->after('wa_opt_in_at');
            $table->timestamp('wa_opted_out_at')->nullable()->after('wa_opt_in_source');
        });
    }

    public function down(): void
    {
        Schema::table('crm_prospects', function (Blueprint $table) {
            $table->dropColumn(['wa_opt_in_at', 'wa_opt_in_source', 'wa_opted_out_at']);
        });
        Schema::dropIfExists('wa_messages');
        Schema::dropIfExists('wa_campaigns');
        Schema::dropIfExists('wa_templates');
        Schema::dropIfExists('whatsapp_accounts');
    }
};
