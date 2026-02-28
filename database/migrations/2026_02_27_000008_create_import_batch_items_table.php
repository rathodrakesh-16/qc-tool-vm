<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('import_batch_items', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('batch_id');
            $table->bigInteger('heading_id');

            $table->foreign('batch_id')
                ->references('id')->on('import_batches')
                ->onDelete('cascade');

            $table->foreign('heading_id')
                ->references('heading_id')->on('headings')
                ->onDelete('cascade');

            $table->unique(['batch_id', 'heading_id'], 'import_batch_items_batch_heading_unique');
            $table->index('heading_id', 'import_batch_items_heading_id_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('import_batch_items');
    }
};
