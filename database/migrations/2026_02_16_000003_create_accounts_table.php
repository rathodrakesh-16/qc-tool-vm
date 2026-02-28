<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('accounts', function (Blueprint $table) {
            $table->bigInteger('account_id')->primary();
            $table->string('account_name');
            $table->string('editor_user_id')->nullable();
            $table->string('qc_user_id')->nullable();
            $table->string('status')->default('assigned');
            $table->date('assigned_date')->nullable();
            $table->date('delivery_date')->nullable();
            $table->boolean('is_system')->default(false);
            $table->string('created_by_user_id')->nullable();
            $table->string('updated_by_user_id')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('editor_user_id')->references('userId')->on('users')->nullOnDelete();
            $table->foreign('qc_user_id')->references('userId')->on('users')->nullOnDelete();
            $table->foreign('created_by_user_id')->references('userId')->on('users')->nullOnDelete();
            $table->foreign('updated_by_user_id')->references('userId')->on('users')->nullOnDelete();

            $table->index('status');
            $table->index('is_system');
            $table->index('delivery_date');
        });

        DB::statement(
            "ALTER TABLE accounts ADD CONSTRAINT accounts_account_id_range_check CHECK (account_id BETWEEN 1 AND 99999999)"
        );
        DB::statement(
            "ALTER TABLE accounts ADD CONSTRAINT accounts_status_allowed_check CHECK (status IN ('assigned', 'inprogress', 'onhold', 'completed'))"
        );
        DB::statement(
            'ALTER TABLE accounts ADD CONSTRAINT accounts_delivery_not_before_assigned_check CHECK (delivery_date IS NULL OR assigned_date IS NULL OR delivery_date >= assigned_date)'
        );
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('accounts');
    }
};
