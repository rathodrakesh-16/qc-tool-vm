<?php

// Filesystem config — local disks only (no cloud storage)

return [
    'default' => env('FILESYSTEM_DISK', 'local'),

    'disks' => [
        // Private files (storage/app/private) — not publicly accessible
        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => true,
            'throw' => false,
            'report' => false,
        ],

        // Public files (storage/app/public) — accessible via /storage URL
        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => rtrim(env('APP_URL', 'http://localhost'), '/').'/storage',
            'visibility' => 'public',
            'throw' => false,
            'report' => false,
        ],
    ],

    // Symbolic link: public/storage -> storage/app/public
    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],
];
