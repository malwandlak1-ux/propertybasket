<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per (property, month) that the agency has run a landlord payout for.
 * Records the rent and how it was split between landlord, agency and agent so
 * the Landlord tab can show history and the agency's rental performance.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('landlord_payouts')) {
            return;
        }

        Schema::create('landlord_payouts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->index();
            $table->foreignId('managed_landlord_id')->index();
            $table->foreignId('listing_id')->index();
            $table->unsignedBigInteger('lease_id')->nullable();
            $table->unsignedBigInteger('agent_id')->nullable();
            $table->date('period_month'); // first day of the month being paid
            $table->decimal('rent_amount', 12, 2)->default(0);
            $table->decimal('landlord_amount', 12, 2)->default(0);
            $table->decimal('agency_amount', 12, 2)->default(0);
            $table->decimal('agent_amount', 12, 2)->default(0);
            $table->string('status')->default('paid'); // pending | paid
            $table->string('payout_method')->nullable(); // bank | paystack | null
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            $table->unique(['listing_id', 'period_month']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('landlord_payouts');
    }
};
