<?php

// Session config — stored in database (sessions table)

use Illuminate\Support\Str;

return [
    'driver' => env('SESSION_DRIVER', 'database'),       // Storage backend
    'lifetime' => (int) env('SESSION_LIFETIME', 120),     // Minutes before session expires
    'expire_on_close' => env('SESSION_EXPIRE_ON_CLOSE', false),
    'encrypt' => env('SESSION_ENCRYPT', false),
    'files' => storage_path('framework/sessions'),        // Only used if driver is 'file'
    'connection' => env('SESSION_CONNECTION'),             // DB connection for session table
    'table' => env('SESSION_TABLE', 'sessions'),
    'store' => env('SESSION_STORE'),                      // Cache store (for cache-based drivers)
    'lottery' => [2, 100],                                // Garbage collection odds (2 in 100 requests)

    // Cookie settings
    'cookie' => env('SESSION_COOKIE', Str::slug((string) env('APP_NAME', 'laravel')).'-session'),
    'path' => env('SESSION_PATH', '/'),
    'domain' => env('SESSION_DOMAIN'),
    'secure' => env('SESSION_SECURE_COOKIE'),             // HTTPS-only cookie
    'http_only' => env('SESSION_HTTP_ONLY', true),        // Blocks JavaScript access to cookie
    'same_site' => env('SESSION_SAME_SITE', 'lax'),       // CSRF protection
    'partitioned' => env('SESSION_PARTITIONED_COOKIE', false),
];
