<?php

namespace App\Domain\Workspace;

use App\Domain\Dashboard\AccountIdFormatter;
use App\Models\Account;
use App\Models\User;
use App\Models\WorkspaceUserPreference;
use RuntimeException;

class WorkspacePreferenceService
{
    public function showForUser(User $user): WorkspaceUserPreference
    {
        return WorkspaceUserPreference::query()->firstOrCreate(
            ['user_id' => $user->userId],
            [
                'active_mode' => 'editor',
                'active_route' => 'production',
                'last_account_id' => null,
                'filters_json' => null,
            ]
        );
    }

    /**
     * @param array<string, mixed> $payload
     */
    public function updateForUser(User $user, array $payload): WorkspaceUserPreference
    {
        $storedLastAccountId = null;
        if (array_key_exists('last_account_id', $payload) && $payload['last_account_id'] !== null) {
            $value = is_numeric($payload['last_account_id'])
                ? (string) (int) $payload['last_account_id']
                : (string) $payload['last_account_id'];
            $storedLastAccountId = AccountIdFormatter::toStoredNullable($value);

            if ($storedLastAccountId === null) {
                throw new RuntimeException('Invalid account id format.');
            }

            $exists = Account::query()->where('account_id', $storedLastAccountId)->exists();
            if (!$exists) {
                throw new RuntimeException('Account not found.');
            }
        }

        $updates = [];
        if (array_key_exists('last_account_id', $payload)) {
            $updates['last_account_id'] = $storedLastAccountId;
        }
        if (array_key_exists('active_mode', $payload)) {
            $updates['active_mode'] = $payload['active_mode'];
        }
        if (array_key_exists('active_route', $payload)) {
            $updates['active_route'] = $payload['active_route'];
        }
        if (array_key_exists('filters_json', $payload)) {
            $updates['filters_json'] = $payload['filters_json'];
        }

        return WorkspaceUserPreference::query()->updateOrCreate(
            ['user_id' => $user->userId],
            $updates
        );
    }
}
