<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_validation_tasks', function (Blueprint $table) {
            $table->string('id', 36)->primary();
            $table->string('status', 20);
            $table->unsignedInteger('total_batches');
            $table->unsignedInteger('completed_batches')->default(0);
            $table->json('results')->default('[]');
            $table->text('warning')->nullable();
            $table->timestamp('expires_at');
            $table->timestamp('created_at')->useCurrent();
        });

        DB::statement(
            "ALTER TABLE ai_validation_tasks ADD CONSTRAINT ai_validation_tasks_status_check CHECK (status IN ('pending','processing','complete','failed'))"
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_validation_tasks');
    }
};