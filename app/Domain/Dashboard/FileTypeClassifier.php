<?php

namespace App\Domain\Dashboard;

class FileTypeClassifier
{
    private const TYPE_MAP = [
        'excel' => ['xlsx', 'xls', 'csv'],
        'pdf'   => ['pdf'],
        'image' => ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'],
        'video' => ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'],
    ];

    /**
     * Classify a filename into a file type based on its extension.
     *
     * @return string One of: excel, pdf, image, video
     * @throws \InvalidArgumentException If the extension is not in any known type
     */
    public static function classify(string $filename): string
    {
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

        foreach (self::TYPE_MAP as $type => $extensions) {
            if (in_array($extension, $extensions, true)) {
                return $type;
            }
        }

        throw new \InvalidArgumentException("Unsupported file extension: {$extension}");
    }

    /**
     * Get all allowed file extensions across all types.
     */
    public static function allowedExtensions(): array
    {
        return array_merge(...array_values(self::TYPE_MAP));
    }

    /**
     * Get the MIME types allowed for upload.
     */
    public static function allowedMimeTypes(): array
    {
        return [
            // Excel
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'text/csv',
            // PDF
            'application/pdf',
            // Image
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/bmp',
            'image/svg+xml',
            'image/webp',
            // Video
            'video/mp4',
            'video/x-msvideo',
            'video/quicktime',
            'video/x-ms-wmv',
            'video/x-flv',
            'video/x-matroska',
            'video/webm',
        ];
    }

    /**
     * Get the type map (type => extensions).
     */
    public static function typeMap(): array
    {
        return self::TYPE_MAP;
    }
}
