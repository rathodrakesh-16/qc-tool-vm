<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('account_notes', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->bigInteger('account_id');
            $table->string('subject');
            $table->text('content');
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

            $table->index('account_id');
            $table->index('subject');
        });

        DB::statement(
            "ALTER TABLE account_notes ADD CONSTRAINT account_notes_subject_check CHECK (subject IN ("
            . "'3rd Party catalog sites', "
            . "'Additional Instructions / Notes', "
            . "'Address Mismatch', "
            . "'Brands', "
            . "'Business Activities', "
            . "'Capabilities', "
            . "'Primary/Secondary Services', "
            . "'Classification', "
            . "'General Account Queries / Issues', "
            . "'Links / URLs', "
            . "'PDM', "
            . "'Domain Change', "
            . "'Primary Company Type', "
            . "'Paid Heading', "
            . "'SDMS Notes', "
            . "'Clients Instructions', "
            . "'Other Info'"
            . '))'
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('account_notes');
    }
};
