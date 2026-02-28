<?php

// QC Tool business logic config — defines allowed statuses, document types, account ID rules,
// note subjects, and account file type rules
// Referenced by: DashboardController, AccountDataController, StoreAccountRequest,
//                UpdateAccountRequest, StoreDocumentRequest, AccountIdFormatter

return [
    // Workflow statuses for QC accounts
    'statuses' => [
        'assigned' => 'Assigned',
        'inprogress' => 'In Progress',
        'onhold' => 'On Hold',
        'completed' => 'Completed',
    ],

    // Supported document types for QC review
    'document_types' => [
        'pdf' => 'PDF',
        'word' => 'Word Document',
        'excel' => 'Excel Spreadsheet',
        'ppt' => 'PowerPoint',
        'image' => 'Image',
        'other' => 'Other',
    ],

    // Account ID validation and display rules (1-8 digit numeric, zero-padded to 8 chars)
    'account_id' => [
        'regex' => '/^(?!0+$)\d{1,8}$/',
        'min' => 1,
        'max' => 99999999,
        'display_length' => 8,
    ],

    // Predefined note subjects for account notes
    'note_subjects' => [
        '3rd Party catalog sites',
        'Additional Instructions / Notes',
        'Address Mismatch',
        'Brands',
        'Business Activities',
        'Capabilities',
        'Primary/Secondary Services',
        'Classification',
        'General Account Queries / Issues',
        'Links / URLs',
        'PDM',
        'Domain Change',
        'Primary Company Type',
        'Paid Heading',
        'SDMS Notes',
        'Clients Instructions',
        'Other Info',
    ],

    // Allowed file extensions for account file uploads, grouped by type
    'account_file_types' => [
        'excel' => ['xlsx', 'xls', 'csv'],
        'pdf'   => ['pdf'],
        'image' => ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'],
        'video' => ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'],
    ],
];
