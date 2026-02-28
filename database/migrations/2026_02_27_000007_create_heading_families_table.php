<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('heading_families', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->bigInteger('heading_id');
            $table->string('family_name');

            $table->foreign('heading_id')
                ->references('heading_id')->on('headings')
                ->onDelete('cascade');

            $table->unique(['heading_id', 'family_name'], 'heading_families_heading_family_unique');
            $table->index('family_name', 'heading_families_family_name_idx');
        });

        DB::statement(
            "ALTER TABLE heading_families ADD CONSTRAINT heading_families_family_name_not_blank_check CHECK (BTRIM(family_name) <> '')"
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('heading_families');
    }
};
