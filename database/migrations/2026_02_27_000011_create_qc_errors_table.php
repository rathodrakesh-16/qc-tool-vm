<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('qc_errors', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->bigInteger('account_id');
            $table->bigInteger('heading_id')->nullable();
            $table->string('error_category');
            $table->text('comment')->nullable();
            $table->string('qc_status', 20)->default('error');
            $table->string('rectification_status', 20)->default('Pending');
            $table->string('validation_status', 20)->default('Pending');
            $table->string('reported_by_user_id')->nullable();
            $table->timestamp('reported_at');
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->foreign('account_id')
                ->references('account_id')->on('accounts')
                ->onDelete('cascade');

            $table->foreign('heading_id')
                ->references('heading_id')->on('headings')
                ->nullOnDelete();

            $table->foreign('reported_by_user_id')
                ->references('userId')->on('users')
                ->nullOnDelete();

            $table->index(['account_id', 'reported_at'], 'qc_errors_account_reported_at_idx');
            $table->index(
                ['account_id', 'rectification_status', 'validation_status'],
                'qc_errors_account_rect_valid_idx'
            );
        });

        DB::statement(
            "ALTER TABLE qc_errors ADD CONSTRAINT qc_errors_qc_status_check CHECK (qc_status IN ('pending', 'checked', 'error'))"
        );
        DB::statement(
            "ALTER TABLE qc_errors ADD CONSTRAINT qc_errors_rectification_status_check CHECK (rectification_status IN ('Pending', 'Done', 'Not Needed'))"
        );
        DB::statement(
            "ALTER TABLE qc_errors ADD CONSTRAINT qc_errors_validation_status_check CHECK (validation_status IN ('Pending', 'Done'))"
        );
        DB::statement(
            "ALTER TABLE qc_errors ADD CONSTRAINT qc_errors_error_category_not_blank_check CHECK (BTRIM(error_category) <> '')"
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('qc_errors');
    }
};
