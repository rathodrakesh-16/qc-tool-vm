<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workspace_user_preferences', function (Blueprint $table) {
            $table->string('user_id')->primary();
            $table->bigInteger('last_account_id')->nullable();
            $table->string('active_mode', 10)->default('editor');
            $table->string('active_route', 30)->default('production');
            $table->json('filters_json')->nullable();
            $table->timestamp('updated_at');

            $table->foreign('user_id')
                ->references('userId')->on('users')
                ->onDelete('cascade');

            $table->foreign('last_account_id')
                ->references('account_id')->on('accounts')
                ->nullOnDelete();

            $table->index('last_account_id', 'workspace_prefs_last_account_idx');
        });

        DB::statement(
            "ALTER TABLE workspace_user_preferences ADD CONSTRAINT workspace_prefs_active_mode_check CHECK (active_mode IN ('editor', 'qc'))"
        );
        DB::statement(
            "ALTER TABLE workspace_user_preferences ADD CONSTRAINT workspace_prefs_active_route_check CHECK (active_route IN ('production', 'account_data', 'production_report', 'qc_review', 'qc_report'))"
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('workspace_user_preferences');
    }
};
