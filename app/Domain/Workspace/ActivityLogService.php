<?php

namespace App\Domain\Workspace;

use App\Models\ActivityLog;
use Carbon\CarbonImmutable;

class ActivityLogService
{
    public function log(
        int $accountId,
        string $action,
        ?string $details = null,
        ?string $actorUserId = null,
        ?string $entityType = null,
        string|int|null $entityId = null
    ): ActivityLog {
        return ActivityLog::query()->create([
            'account_id' => $accountId,
            'action' => $action,
            'details' => $details,
            'actor_user_id' => $actorUserId,
            'entity_type' => $entityType,
            'entity_id' => $entityId !== null ? (string) $entityId : null,
            'created_at' => CarbonImmutable::now(),
        ]);
    }
}

