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
        Schema::create('users', function (Blueprint $table) {
            $table->uuid('uuid')->primary();
            $table->string('userId');
            $table->string('username');
            $table->string('email');
            $table->string('role')->default('user');
            $table->string('designation');
            $table->string('team');
            $table->string('location');
            $table->string('department');

            $table->string('password');
            $table->timestamp('email_verified_at')->nullable();
            $table->rememberToken();

            $table->timestamps();
            $table->softDeletes();

            $table->unique('userId');
            $table->unique(['email', 'deleted_at']);
        });

        // Enforce userId = email, lowercase, and email format at DB level.
        DB::statement('ALTER TABLE users ADD CONSTRAINT users_userid_matches_email_check CHECK ("userId" = email)');
        DB::statement('ALTER TABLE users ADD CONSTRAINT users_userid_lowercase_check CHECK ("userId" = LOWER("userId"))');
        DB::statement(
            'ALTER TABLE users ADD CONSTRAINT users_userid_email_check CHECK ("userId" ~* \'^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$\')'
        );
        DB::statement(
            "ALTER TABLE users ADD CONSTRAINT users_role_allowed_check CHECK (role IN ('admin', 'user'))"
        );
        DB::statement('ALTER TABLE users ADD CONSTRAINT users_username_not_blank_check CHECK (BTRIM(username) <> \'\')');
        DB::statement('ALTER TABLE users ADD CONSTRAINT users_designation_not_blank_check CHECK (BTRIM(designation) <> \'\')');
        DB::statement('ALTER TABLE users ADD CONSTRAINT users_team_not_blank_check CHECK (BTRIM(team) <> \'\')');
        DB::statement('ALTER TABLE users ADD CONSTRAINT users_department_not_blank_check CHECK (BTRIM(department) <> \'\')');
        DB::statement('ALTER TABLE users ADD CONSTRAINT users_location_not_blank_check CHECK (BTRIM(location) <> \'\')');
        DB::statement('CREATE UNIQUE INDEX users_username_active_unique ON users (username) WHERE deleted_at IS NULL');

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('user_id')->nullable()->index();
            $table->string('username')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('sessions');
    }
};
