<?php

// Sanctum config — handles SPA cookie-based authentication
// The frontend sends session cookies (not API tokens) for auth

use Laravel\Sanctum\Sanctum;

return [
    // Domains that receive stateful session cookies (must match your frontend URLs)
    'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', sprintf(
        '%s%s',
        'localhost,localhost:3000,127.0.0.1,127.0.0.1:8000,::1',
        Sanctum::currentApplicationUrlWithPort(),
    ))),

    // Auth guard used for session authentication
    'guard' => ['web'],

    // Token expiration (null = no expiry, not used in SPA mode)
    'expiration' => null,
    'token_prefix' => env('SANCTUM_TOKEN_PREFIX', ''),

    // Middleware applied to Sanctum's stateful API requests
    'middleware' => [
        'authenticate_session' => Laravel\Sanctum\Http\Middleware\AuthenticateSession::class,
        'encrypt_cookies' => Illuminate\Cookie\Middleware\EncryptCookies::class,
        'validate_csrf_token' => Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class,
    ],
];
