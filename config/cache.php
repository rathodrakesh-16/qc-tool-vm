<?php

// Cache config — defaults to file-based caching

use Illuminate\Support\Str;

return [
    'default' => env('CACHE_STORE', 'file'),

    'stores' => [
        // In-memory cache (used for testing)
        'array' => [
            'driver' => 'array',
            'serialize' => false,
        ],

        // Database-backed cache (uses 'cache' table)
        'database' => [
            'driver' => 'database',
            'connection' => env('DB_CACHE_CONNECTION'),
            'table' => env('DB_CACHE_TABLE', 'cache'),
            'lock_connection' => env('DB_CACHE_LOCK_CONNECTION'),
            'lock_table' => env('DB_CACHE_LOCK_TABLE'),
        ],

        // File-based cache (stored in storage/framework/cache/data)
        'file' => [
            'driver' => 'file',
            'path' => storage_path('framework/cache/data'),
            'lock_path' => storage_path('framework/cache/data'),
        ],
    ],

    // Prefix to avoid key collisions
    'prefix' => env('CACHE_PREFIX', Str::slug((string) env('APP_NAME', 'laravel')).'-cache-'),
];
