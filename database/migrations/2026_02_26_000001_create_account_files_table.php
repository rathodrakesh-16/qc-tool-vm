<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('account_files', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->bigInteger('account_id');
            $table->string('original_name');
            $table->string('stored_name');
            $table->string('disk')->default('local');
            $table->string('path');
            $table->string('mime_type');
            $table->string('file_type');
            $table->unsignedBigInteger('size');
            $table->string('uploaded_by_user_id')->nullable();
            $table->timestamps();

            $table->foreign('account_id')
                ->references('account_id')->on('accounts')
                ->onDelete('cascade');

            $table->foreign('uploaded_by_user_id')
                ->references('userId')->on('users')
                ->nullOnDelete();

            $table->index('account_id');
            $table->index('file_type');
        });

        DB::statement(
            "ALTER TABLE account_files ADD CONSTRAINT account_files_file_type_check CHECK (file_type IN ('excel', 'pdf', 'image', 'video'))"
        );
        DB::statement(
            'ALTER TABLE account_files ADD CONSTRAINT account_files_size_positive_check CHECK (size > 0)'
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('account_files');
    }
};
