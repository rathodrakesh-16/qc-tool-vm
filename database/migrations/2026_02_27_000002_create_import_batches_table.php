<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('import_batches', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->bigInteger('account_id');
            $table->string('context_family')->nullable();
            $table->string('file_name');
            $table->unsignedInteger('headings_count');
            $table->string('imported_by_user_id')->nullable();
            $table->timestamp('imported_at');

            $table->foreign('account_id')
                ->references('account_id')->on('accounts')
                ->onDelete('cascade');

            $table->foreign('imported_by_user_id')
                ->references('userId')->on('users')
                ->nullOnDelete();

            $table->index(['account_id', 'imported_at'], 'import_batches_account_imported_at_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('import_batches');
    }
};
