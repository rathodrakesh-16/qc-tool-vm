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
        Schema::create('documents', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('doccument_name');
            $table->text('doccument_link');
            $table->string('doc_type')->default('other');
            $table->string('icon_class')->nullable();
            $table->boolean('is_system')->default(false);
            $table->string('created_by_user_id')->nullable();
            $table->string('updated_by_user_id')->nullable();
            $table->timestamps();

            $table->foreign('created_by_user_id')->references('userId')->on('users')->nullOnDelete();
            $table->foreign('updated_by_user_id')->references('userId')->on('users')->nullOnDelete();

            $table->index('doc_type');
            $table->index('is_system');
            $table->index('created_at');
        });

        DB::statement(
            "ALTER TABLE documents ADD CONSTRAINT documents_doc_type_allowed_check CHECK (doc_type IN ('pdf', 'word', 'excel', 'ppt', 'image', 'other'))"
        );
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('documents');
    }
};
