<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscription_plans', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->enum('target_role', ['agency', 'landlord']);
            $table->decimal('price_monthly', 10, 2);
            $table->unsignedInteger('property_limit')->nullable();
            $table->unsignedInteger('agent_limit')->nullable();
            $table->json('features')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->morphs('subscriber'); // subscriber_type, subscriber_id
            $table->foreignId('plan_id')->constrained('subscription_plans')->cascadeOnDelete();
            $table->string('paystack_subscription_code')->nullable();
            $table->enum('status', ['active', 'past_due', 'cancelled'])->default('active')->index();
            $table->timestamp('trial_ends_at')->nullable();
            $table->timestamp('current_period_end')->nullable();
            $table->timestamps();
        });

        Schema::create('platform_transactions', function (Blueprint $table) {
            $table->id();
            $table->morphs('subscriber'); // subscriber_type, subscriber_id
            $table->enum('type', ['subscription', 'platform_fee', 'contractor_fee']);
            $table->decimal('amount', 12, 2);
            $table->string('description')->nullable();
            $table->string('paystack_reference')->nullable();
            $table->enum('status', ['pending', 'paid', 'failed'])->default('pending')->index();
            $table->timestamps();
        });

        Schema::create('announcements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->text('body');
            $table->enum('audience', ['all', 'agencies', 'landlords', 'contractors', 'tenants']);
            $table->boolean('send_email')->default(false);
            $table->boolean('show_banner')->default(true);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('announcements');
        Schema::dropIfExists('platform_transactions');
        Schema::dropIfExists('subscriptions');
        Schema::dropIfExists('subscription_plans');
    }
};
