<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agencies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('logo')->nullable();
            $table->string('website')->nullable();
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->string('head_office_address')->nullable();

            $table->string('eaab_ffc_number')->nullable();
            $table->timestamp('eaab_verified_at')->nullable();

            $table->boolean('vat_registered')->default(false);
            $table->string('vat_number')->nullable();
            $table->decimal('vat_rate', 5, 2)->default(15.00);

            $table->string('paystack_subaccount_code')->nullable();
            $table->string('trust_bank')->nullable();
            $table->string('trust_account_number')->nullable();
            $table->string('trust_branch_code')->nullable();
            $table->unsignedTinyInteger('payout_day')->default(1);

            $table->enum('status', ['active', 'pending', 'suspended'])->default('pending')->index();
            $table->string('subscription_plan')->nullable();
            $table->timestamp('subscription_expires_at')->nullable();

            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agencies');
    }
};
