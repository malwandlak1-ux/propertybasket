<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Managed landlords — landlords who have appointed an agency to manage their
 * rental property. They do NOT log in (unlike self-service landlords who own a
 * User account). The agency captures their contact + banking details here and
 * pays them out via the landlord payment batch.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('managed_landlords')) {
            return;
        }

        Schema::create('managed_landlords', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->index();
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->string('bank_name')->nullable();
            $table->string('bank_account_holder')->nullable();
            $table->string('bank_account_number')->nullable();
            $table->string('bank_branch_code')->nullable();
            $table->string('bank_account_type')->nullable();
            $table->string('paystack_recipient_code')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('managed_landlords');
    }
};
