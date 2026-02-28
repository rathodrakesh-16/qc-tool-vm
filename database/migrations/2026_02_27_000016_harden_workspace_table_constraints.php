<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // headings: account_id + status composite index for report queries
        Schema::table('headings', function (Blueprint $table) {
            $table->index(['account_id', 'status'], 'headings_account_status_idx');
        });

        // import_batches: file_name not blank
        DB::statement(
            "ALTER TABLE import_batches ADD CONSTRAINT import_batches_file_name_not_blank_check CHECK (BTRIM(file_name) <> '')"
        );

        // import_batches: headings_count positive
        DB::statement(
            'ALTER TABLE import_batches ADD CONSTRAINT import_batches_headings_count_positive_check CHECK (headings_count > 0)'
        );

        // pdms: word_count non-negative
        DB::statement(
            'ALTER TABLE pdms ADD CONSTRAINT pdms_word_count_non_negative_check CHECK (word_count >= 0)'
        );

        // activity_logs: action not blank
        DB::statement(
            "ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_action_not_blank_check CHECK (BTRIM(action) <> '')"
        );

        // qc_errors: resolved_at must be >= reported_at when set
        DB::statement(
            'ALTER TABLE qc_errors ADD CONSTRAINT qc_errors_resolved_after_reported_check CHECK (resolved_at IS NULL OR resolved_at >= reported_at)'
        );

        // pdm_qc_feedback: feedback_at index for ordering
        Schema::table('pdm_qc_feedback', function (Blueprint $table) {
            $table->index('feedback_at', 'pdm_qc_feedback_feedback_at_idx');
        });

        // qc_errors: account_id + qc_status composite index
        Schema::table('qc_errors', function (Blueprint $table) {
            $table->index(['account_id', 'qc_status'], 'qc_errors_account_qc_status_idx');
        });

        // pdms: account_id + rectification_status composite index for report filtering
        Schema::table('pdms', function (Blueprint $table) {
            $table->index(['account_id', 'rectification_status'], 'pdms_account_rectification_idx');
            $table->index(['account_id', 'validation_status'], 'pdms_account_validation_idx');
        });
    }

    public function down(): void
    {
        Schema::table('pdms', function (Blueprint $table) {
            $table->dropIndex('pdms_account_validation_idx');
            $table->dropIndex('pdms_account_rectification_idx');
        });

        Schema::table('qc_errors', function (Blueprint $table) {
            $table->dropIndex('qc_errors_account_qc_status_idx');
        });

        Schema::table('pdm_qc_feedback', function (Blueprint $table) {
            $table->dropIndex('pdm_qc_feedback_feedback_at_idx');
        });

        DB::statement('ALTER TABLE qc_errors DROP CONSTRAINT IF EXISTS qc_errors_resolved_after_reported_check');
        DB::statement('ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_action_not_blank_check');
        DB::statement('ALTER TABLE pdms DROP CONSTRAINT IF EXISTS pdms_word_count_non_negative_check');
        DB::statement('ALTER TABLE import_batches DROP CONSTRAINT IF EXISTS import_batches_headings_count_positive_check');
        DB::statement('ALTER TABLE import_batches DROP CONSTRAINT IF EXISTS import_batches_file_name_not_blank_check');

        Schema::table('headings', function (Blueprint $table) {
            $table->dropIndex('headings_account_status_idx');
        });
    }
};
