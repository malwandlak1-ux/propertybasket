<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inspections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lease_id')->constrained('leases')->cascadeOnDelete();
            $table->enum('type', ['move_in', 'move_out', 'annual'])->index();
            $table->foreignId('conducted_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('tenant_id')->constrained('users')->cascadeOnDelete();
            $table->enum('status', ['in_progress', 'awaiting_signature', 'completed'])
                ->default('in_progress')
                ->index();
            $table->json('rooms')->nullable();
            $table->timestamp('agent_signed_at')->nullable();
            $table->string('agent_signature')->nullable();
            $table->timestamp('tenant_signed_at')->nullable();
            $table->string('tenant_signature')->nullable();
            $table->string('pdf_path')->nullable();
            $table->decimal('deduction_total', 12, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('inspection_deductions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inspection_id')->constrained('inspections')->cascadeOnDelete();
            $table->string('room');
            $table->text('description');
            $table->decimal('amount', 12, 2);
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('disputed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inspection_deductions');
        Schema::dropIfExists('inspections');
    }
};
