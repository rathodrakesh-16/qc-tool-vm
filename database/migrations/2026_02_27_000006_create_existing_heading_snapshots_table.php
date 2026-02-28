<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('existing_heading_snapshots', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->bigInteger('account_id');
            $table->string('file_name')->nullable();
            $table->string('uploaded_by_user_id')->nullable();
            $table->timestamp('uploaded_at');
            $table->boolean('is_active')->default(true);

            $table->foreign('account_id')
                ->references('account_id')->on('accounts')
                ->onDelete('cascade');

            $table->foreign('uploaded_by_user_id')
                ->references('userId')->on('users')
                ->nullOnDelete();

            $table->index(['account_id', 'uploaded_at'], 'existing_snapshots_account_uploaded_at_idx');
            $table->index(['account_id', 'is_active'], 'existing_snapshots_account_is_active_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('existing_heading_snapshots');
    }
};
