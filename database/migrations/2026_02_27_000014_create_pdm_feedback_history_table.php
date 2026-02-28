<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pdm_feedback_history', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->bigInteger('pdm_id');
            $table->string('feedback_user_id')->nullable();
            $table->timestamp('feedback_at');
            $table->text('updated_description')->nullable();
            $table->text('comment')->nullable();
            $table->json('errors_json')->nullable();

            $table->foreign('pdm_id')
                ->references('pdm_id')->on('pdms')
                ->onDelete('cascade');

            $table->foreign('feedback_user_id')
                ->references('userId')->on('users')
                ->nullOnDelete();

            $table->index(['pdm_id', 'feedback_at'], 'pdm_feedback_history_pdm_feedback_at_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pdm_feedback_history');
    }
};
