<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pdm_status_events', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->bigInteger('pdm_id');
            $table->string('event_type', 40);
            $table->json('from_state')->nullable();
            $table->json('to_state')->nullable();
            $table->string('actor_user_id')->nullable();
            $table->timestamp('created_at');

            $table->foreign('pdm_id')
                ->references('pdm_id')->on('pdms')
                ->onDelete('cascade');

            $table->foreign('actor_user_id')
                ->references('userId')->on('users')
                ->nullOnDelete();

            $table->index(['pdm_id', 'created_at'], 'pdm_status_events_pdm_created_at_idx');
            $table->index('event_type', 'pdm_status_events_event_type_idx');
        });

        DB::statement(
            "ALTER TABLE pdm_status_events ADD CONSTRAINT pdm_status_events_event_type_check CHECK (event_type IN ('created', 'updated', 'deleted', 'qc_feedback_submitted', 'qc_status_changed', 'rectification_status_changed', 'validation_status_changed', 'published_status_changed'))"
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('pdm_status_events');
    }
};
