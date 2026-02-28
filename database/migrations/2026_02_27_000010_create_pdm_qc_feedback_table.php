<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pdm_qc_feedback', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->bigInteger('pdm_id')->unique();
            $table->text('updated_description')->nullable();
            $table->text('comment')->nullable();
            $table->string('feedback_user_id')->nullable();
            $table->timestamp('feedback_at');
            $table->timestamps();

            $table->foreign('pdm_id')
                ->references('pdm_id')->on('pdms')
                ->onDelete('cascade');

            $table->foreign('feedback_user_id')
                ->references('userId')->on('users')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pdm_qc_feedback');
    }
};
