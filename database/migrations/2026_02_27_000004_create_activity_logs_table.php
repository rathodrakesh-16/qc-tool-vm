<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->bigInteger('account_id');
            $table->string('action');
            $table->text('details')->nullable();
            $table->string('actor_user_id')->nullable();
            $table->string('entity_type', 64)->nullable();
            $table->string('entity_id', 128)->nullable();
            $table->timestamp('created_at');

            $table->foreign('account_id')
                ->references('account_id')->on('accounts')
                ->onDelete('cascade');

            $table->foreign('actor_user_id')
                ->references('userId')->on('users')
                ->nullOnDelete();

            $table->index(['account_id', 'created_at'], 'activity_logs_account_created_at_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
