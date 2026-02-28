<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pdms', function (Blueprint $table) {
            $table->bigInteger('pdm_id')->primary();
            $table->bigInteger('account_id');
            $table->boolean('is_copro')->default(false);
            $table->text('url')->nullable();
            $table->json('company_type');
            $table->string('type_of_proof')->nullable();
            $table->text('description');
            $table->text('comment')->nullable();
            $table->unsignedInteger('word_count');
            $table->boolean('uploaded')->default(false);
            $table->string('qc_status', 20)->default('pending');
            $table->string('rectification_status', 20)->default('Not Needed');
            $table->string('validation_status', 20)->default('Pending');
            $table->boolean('is_qc_edited')->default(false);
            $table->boolean('is_description_updated')->default(false);
            $table->string('created_by_user_id')->nullable();
            $table->string('updated_by_user_id')->nullable();
            $table->timestamps();

            $table->foreign('account_id')
                ->references('account_id')->on('accounts')
                ->onDelete('cascade');

            $table->foreign('created_by_user_id')
                ->references('userId')->on('users')
                ->nullOnDelete();

            $table->foreign('updated_by_user_id')
                ->references('userId')->on('users')
                ->nullOnDelete();

            $table->index(['account_id', 'created_at'], 'pdms_account_created_at_idx');
            $table->index(['account_id', 'qc_status'], 'pdms_account_qc_status_idx');
            $table->index(['account_id', 'uploaded'], 'pdms_account_uploaded_idx');
        });

        DB::statement(
            "ALTER TABLE pdms ADD CONSTRAINT pdms_qc_status_check CHECK (qc_status IN ('pending', 'checked', 'error'))"
        );
        DB::statement(
            "ALTER TABLE pdms ADD CONSTRAINT pdms_rectification_status_check CHECK (rectification_status IN ('Pending', 'Done', 'Not Needed'))"
        );
        DB::statement(
            "ALTER TABLE pdms ADD CONSTRAINT pdms_validation_status_check CHECK (validation_status IN ('Pending', 'Done'))"
        );
        DB::statement(
            "ALTER TABLE pdms ADD CONSTRAINT pdms_description_not_blank_check CHECK (BTRIM(description) <> '')"
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('pdms');
    }
};
