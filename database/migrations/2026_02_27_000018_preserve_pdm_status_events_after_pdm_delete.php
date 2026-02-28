<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pdm_status_events', function (Blueprint $table) {
            $table->dropForeign(['pdm_id']);
        });
    }

    public function down(): void
    {
        DB::statement(
            'DELETE FROM pdm_status_events WHERE pdm_id NOT IN (SELECT pdm_id FROM pdms)'
        );

        Schema::table('pdm_status_events', function (Blueprint $table) {
            $table->foreign('pdm_id')
                ->references('pdm_id')->on('pdms')
                ->onDelete('cascade');
        });
    }
};
