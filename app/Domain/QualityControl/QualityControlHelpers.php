<?php

namespace App\Domain\QualityControl;

trait QualityControlHelpers
{
    /**
     * @param mixed $value
     */
    private function toString($value): string
    {
        if (is_null($value)) {
            return '';
        }

        if (is_scalar($value)) {
            return (string) $value;
        }

        return '';
    }

    /**
     * @param mixed $value
     * @return array<int, mixed>
     */
    private function arrayOrEmpty($value): array
    {
        return is_array($value) ? $value : [];
    }

    private function isNoUrl(string $url): bool
    {
        $trimmed = trim($url);
        return $trimmed === '' || strtolower($trimmed) === 'no url assigned';
    }
}