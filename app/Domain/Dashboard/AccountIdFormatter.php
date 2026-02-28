<?php

namespace App\Domain\Dashboard;

class AccountIdFormatter
{
    public static function toStored(string $accountId): int
    {
        $normalized = ltrim(trim($accountId), '0');
        if ($normalized === '') {
            return 0;
        }

        return (int) $normalized;
    }

    public static function toStoredNullable(?string $accountId): ?int
    {
        if ($accountId === null) {
            return null;
        }

        $trimmed = trim($accountId);
        if (!preg_match('/^\d+$/', $trimmed)) {
            return null;
        }

        $stored = self::toStored($trimmed);
        return $stored > 0 ? $stored : null;
    }

    public static function toDisplay(int|string $accountId): string
    {
        $length = (int) config('dashboard.account_id.display_length', 8);

        return str_pad((string) $accountId, $length, '0', STR_PAD_LEFT);
    }
}
