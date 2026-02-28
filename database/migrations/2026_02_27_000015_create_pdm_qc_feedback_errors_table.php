<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pdm_qc_feedback_errors', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('feedback_id');
            $table->string('error_category');

            $table->foreign('feedback_id')
                ->references('id')->on('pdm_qc_feedback')
                ->onDelete('cascade');

            $table->unique(['feedback_id', 'error_category'], 'feedback_errors_feedback_category_unique');
            $table->index('error_category', 'feedback_errors_error_category_idx');
        });

        DB::statement(
            "ALTER TABLE pdm_qc_feedback_errors ADD CONSTRAINT feedback_errors_category_not_blank_check CHECK (BTRIM(error_category) <> '')"
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('pdm_qc_feedback_errors');
    }
};
