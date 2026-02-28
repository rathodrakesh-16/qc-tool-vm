<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('account_comments', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->bigInteger('account_id');
            $table->text('text');
            $table->string('user_id')->nullable();
            $table->timestamps();

            $table->foreign('account_id')
                ->references('account_id')->on('accounts')
                ->onDelete('cascade');

            $table->foreign('user_id')
                ->references('userId')->on('users')
                ->nullOnDelete();

            $table->index('account_id');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('account_comments');
    }
};
