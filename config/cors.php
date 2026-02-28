<?php

// CORS config — required for Sanctum SPA cookie-based authentication
// Allows the frontend to make credentialed requests to API, login, and logout routes

return [
    // Routes that accept cross-origin requests
    'paths' => ['api/*', 'login', 'logout', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    // Allowed origins — reads from CORS_ALLOWED_ORIGINS or falls back to FRONTEND_URL
    'allowed_origins' => explode(',', env('CORS_ALLOWED_ORIGINS', env('FRONTEND_URL', 'http://127.0.0.1:8000'))),

    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,

    // Must be true for Sanctum session cookies to work cross-origin
    'supports_credentials' => true,
];
