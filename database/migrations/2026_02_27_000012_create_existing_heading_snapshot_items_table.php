<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('existing_heading_snapshot_items', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('snapshot_id');
            $table->bigInteger('heading_id');
            $table->string('heading_name');
            $table->string('rank_points', 64)->nullable();
            $table->text('definition')->nullable();
            $table->string('category')->nullable();
            $table->string('family')->nullable();
            $table->string('company_type')->nullable();
            $table->text('profile_description')->nullable();
            $table->text('site_link')->nullable();
            $table->string('quality')->nullable();
            $table->string('source_last_updated')->nullable();

            $table->foreign('snapshot_id')
                ->references('id')->on('existing_heading_snapshots')
                ->onDelete('cascade');

            $table->unique(['snapshot_id', 'heading_id'], 'snapshot_items_snapshot_heading_unique');
            $table->index('snapshot_id', 'snapshot_items_snapshot_id_idx');
        });

        DB::statement(
            "ALTER TABLE existing_heading_snapshot_items ADD CONSTRAINT snapshot_items_heading_name_not_blank_check CHECK (BTRIM(heading_name) <> '')"
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('existing_heading_snapshot_items');
    }
};
