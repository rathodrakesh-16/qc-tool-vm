<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pdm_headings', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->bigInteger('pdm_id');
            $table->bigInteger('heading_id');
            $table->smallInteger('sort_order')->unsigned();

            $table->foreign('pdm_id')
                ->references('pdm_id')->on('pdms')
                ->onDelete('cascade');

            $table->foreign('heading_id')
                ->references('heading_id')->on('headings')
                ->onDelete('cascade');

            $table->unique(['pdm_id', 'heading_id'], 'pdm_headings_pdm_heading_unique');
            $table->index(['pdm_id', 'sort_order'], 'pdm_headings_pdm_sort_order_idx');
        });

        DB::statement(
            'ALTER TABLE pdm_headings ADD CONSTRAINT pdm_headings_sort_order_range_check CHECK (sort_order BETWEEN 1 AND 8)'
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('pdm_headings');
    }
};
