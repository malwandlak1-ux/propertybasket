<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM: property farming (region → suburb → sectional-title scheme → owner
 * prospects) plus an outreach log for call / WhatsApp / SMS / email stats.
 *
 * Regions and suburbs with agency_id NULL are shared reference data (the
 * Pretoria farming masters); agencies can add their own on top. Schemes,
 * prospects and activities always belong to one agent.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('crm_regions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('slug', 80);
            $table->string('name', 120);
            $table->unsignedSmallInteger('sort')->default(0);
            $table->timestamps();

            $table->index(['agency_id', 'sort']);
        });

        Schema::create('crm_suburbs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('crm_region_id')->constrained('crm_regions')->cascadeOnDelete();
            $table->foreignId('agency_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('name', 120);
            $table->string('municipality', 120)->nullable();
            $table->string('signal', 20)->nullable();
            $table->string('angle', 255)->nullable();
            $table->unsignedSmallInteger('priority')->nullable();
            $table->json('stats')->nullable();
            $table->timestamps();

            $table->index(['crm_region_id', 'agency_id']);
        });

        Schema::create('crm_schemes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('crm_suburb_id')->constrained('crm_suburbs')->cascadeOnDelete();
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $table->foreignId('agent_id')->constrained('users')->cascadeOnDelete();
            $table->string('name', 160);
            $table->string('scheme_number', 60)->nullable();
            $table->string('erf', 60)->nullable();
            $table->string('address', 255)->nullable();
            $table->unsignedInteger('units_count')->nullable();
            $table->timestamps();

            $table->index(['agent_id', 'crm_suburb_id']);
            $table->index(['agency_id', 'crm_suburb_id']);
        });

        Schema::create('crm_prospects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('crm_scheme_id')->constrained('crm_schemes')->cascadeOnDelete();
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $table->foreignId('agent_id')->constrained('users')->cascadeOnDelete();
            $table->string('unit', 40)->nullable();
            $table->string('size', 40)->nullable();
            $table->string('owner_name', 255);
            $table->string('owner_type', 80)->nullable();
            $table->string('id_reg', 40)->nullable();
            $table->string('multi_unit', 120)->nullable();
            $table->string('phone1', 30)->nullable();
            $table->string('phone2', 30)->nullable();
            $table->string('email', 180)->nullable();
            $table->string('priority_note', 255)->nullable();
            $table->string('status', 30)->default('not_contacted');
            $table->string('method', 20)->nullable();
            $table->date('contacted_on')->nullable();
            $table->decimal('est_value', 14, 2)->nullable();
            $table->string('response', 500)->nullable();
            $table->string('next_action', 500)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('inquiry_id')->nullable()->constrained('inquiries')->nullOnDelete();
            $table->timestamps();

            $table->index(['agent_id', 'status']);
            $table->index(['agency_id', 'status']);
        });

        Schema::create('crm_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $table->foreignId('agent_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('crm_prospect_id')->nullable()->constrained('crm_prospects')->nullOnDelete();
            $table->string('channel', 20);
            $table->string('outcome', 20)->nullable();
            $table->unsignedInteger('quantity')->default(1);
            $table->string('note', 500)->nullable();
            $table->date('occurred_on');
            $table->timestamps();

            $table->index(['agent_id', 'occurred_on']);
            $table->index(['agency_id', 'occurred_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_activities');
        Schema::dropIfExists('crm_prospects');
        Schema::dropIfExists('crm_schemes');
        Schema::dropIfExists('crm_suburbs');
        Schema::dropIfExists('crm_regions');
    }
};
