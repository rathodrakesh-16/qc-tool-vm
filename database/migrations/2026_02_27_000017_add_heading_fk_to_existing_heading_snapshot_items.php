<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('existing_heading_snapshot_items', function (Blueprint $table) {
            $table->bigInteger('heading_id')->nullable()->change();

            $table->foreign('heading_id')
                ->references('heading_id')->on('headings')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('existing_heading_snapshot_items', function (Blueprint $table) {
            $table->dropForeign(['heading_id']);
            $table->bigInteger('heading_id')->nullable(false)->change();
        });
    }
};
