<?php

// Authentication config — uses session-based auth with Eloquent User model

return [
    // Default guard and password broker
    'defaults' => [
        'guard' => 'web',
        'passwords' => 'users',
    ],

    // Session-based web guard
    'guards' => [
        'web' => [
            'driver' => 'session',
            'provider' => 'users',
        ],
    ],

    // User provider — fetches users via Eloquent
    'providers' => [
        'users' => [
            'driver' => 'eloquent',
            'model' => App\Models\User::class,
        ],
    ],

    // Password reset settings (token expires in 60 min, throttled to 1 per 60 sec)
    'passwords' => [
        'users' => [
            'provider' => 'users',
            'table' => 'password_reset_tokens',
            'expire' => 60,
            'throttle' => 60,
        ],
    ],

    // Password confirmation timeout (3 hours)
    'password_timeout' => 10800,
];
