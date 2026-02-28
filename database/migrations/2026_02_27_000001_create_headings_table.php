<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('headings', function (Blueprint $table) {
            $table->bigInteger('heading_id')->primary();
            $table->bigInteger('account_id');
            $table->string('heading_name');
            $table->json('families_json')->nullable();
            $table->string('grouping_family')->nullable();
            $table->text('supported_link')->nullable();
            $table->string('workflow_stage', 20)->default('imported');
            $table->string('status', 20)->default('additional');
            $table->string('rank_points', 64)->nullable();
            $table->string('heading_type')->nullable();
            $table->string('source_status')->nullable();
            $table->string('source_updated_at')->nullable();
            $table->text('definition')->nullable();
            $table->text('aliases')->nullable();
            $table->string('category')->nullable();
            $table->text('companies')->nullable();
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

            $table->index(['account_id', 'workflow_stage'], 'headings_account_workflow_stage_idx');
            $table->index(['account_id', 'grouping_family'], 'headings_account_grouping_family_idx');
        });

        DB::statement(
            "ALTER TABLE headings ADD CONSTRAINT headings_workflow_stage_check CHECK (workflow_stage IN ('imported', 'supported', 'assigned'))"
        );
        DB::statement(
            "ALTER TABLE headings ADD CONSTRAINT headings_status_check CHECK (status IN ('existing', 'ranked', 'additional'))"
        );
        DB::statement(
            "ALTER TABLE headings ADD CONSTRAINT headings_heading_name_not_blank_check CHECK (BTRIM(heading_name) <> '')"
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('headings');
    }
};
