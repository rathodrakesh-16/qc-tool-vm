<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('account_files', function (Blueprint $table) {
            $table->unique('path', 'account_files_path_unique');
            $table->index(['account_id', 'created_at'], 'account_files_account_created_at_idx');
        });

        Schema::table('account_notes', function (Blueprint $table) {
            $table->index(['account_id', 'created_at'], 'account_notes_account_created_at_idx');
        });

        Schema::table('account_comments', function (Blueprint $table) {
            $table->dropIndex('account_comments_created_at_index');
            $table->index(['account_id', 'created_at'], 'account_comments_account_created_at_idx');
        });

        DB::statement(
            "ALTER TABLE account_files ADD CONSTRAINT account_files_original_name_not_blank_check CHECK (BTRIM(original_name) <> '')"
        );
        DB::statement(
            "ALTER TABLE account_files ADD CONSTRAINT account_files_stored_name_not_blank_check CHECK (BTRIM(stored_name) <> '')"
        );
        DB::statement(
            "ALTER TABLE account_files ADD CONSTRAINT account_files_path_not_blank_check CHECK (BTRIM(path) <> '')"
        );
        DB::statement(
            "ALTER TABLE account_files ADD CONSTRAINT account_files_mime_type_not_blank_check CHECK (BTRIM(mime_type) <> '')"
        );
        DB::statement(
            "ALTER TABLE account_notes ADD CONSTRAINT account_notes_content_not_blank_check CHECK (BTRIM(content) <> '')"
        );
        DB::statement(
            "ALTER TABLE account_comments ADD CONSTRAINT account_comments_text_not_blank_check CHECK (BTRIM(text) <> '')"
        );
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE account_comments DROP CONSTRAINT IF EXISTS account_comments_text_not_blank_check');
        DB::statement('ALTER TABLE account_notes DROP CONSTRAINT IF EXISTS account_notes_content_not_blank_check');
        DB::statement('ALTER TABLE account_files DROP CONSTRAINT IF EXISTS account_files_mime_type_not_blank_check');
        DB::statement('ALTER TABLE account_files DROP CONSTRAINT IF EXISTS account_files_path_not_blank_check');
        DB::statement('ALTER TABLE account_files DROP CONSTRAINT IF EXISTS account_files_stored_name_not_blank_check');
        DB::statement('ALTER TABLE account_files DROP CONSTRAINT IF EXISTS account_files_original_name_not_blank_check');

        Schema::table('account_comments', function (Blueprint $table) {
            $table->dropIndex('account_comments_account_created_at_idx');
            $table->index('created_at');
        });

        Schema::table('account_notes', function (Blueprint $table) {
            $table->dropIndex('account_notes_account_created_at_idx');
        });

        Schema::table('account_files', function (Blueprint $table) {
            $table->dropIndex('account_files_account_created_at_idx');
            $table->dropUnique('account_files_path_unique');
        });
    }
};
