<?php

namespace App\Http\Controllers\Concerns;

use App\Domain\Dashboard\AccountIdFormatter;
use App\Models\Account;

trait ResolvesWorkspaceAccount
{
    protected function resolveAccount(string $accountCode): Account
    {
        $storedId = AccountIdFormatter::toStoredNullable($accountCode);
        abort_if($storedId === null, 404);

        return Account::query()->where('account_id', $storedId)->firstOrFail();
    }
}

