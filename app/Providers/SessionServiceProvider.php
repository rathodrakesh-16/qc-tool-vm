<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class SessionServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        \Illuminate\Support\Facades\Session::extend('database', function ($app) {
            $table = $app['config']['session.table'];
            $connection = $app['db']->connection($app['config']['session.connection']);

            return new \App\Extensions\UsernameDatabaseSessionHandler(
                $connection,
                $table,
                $app['config']['session.lifetime'],
                $app
            );
        });
    }
}
