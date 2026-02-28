<?php

namespace App\Domain\Workspace;

use App\Models\Heading;
use App\Models\QcError;
use RuntimeException;

class QcErrorService
{
    public function __construct(
        private readonly ActivityLogService $activityLogService
    ) {
    }

    /**
     * @param array<string, mixed> $payload
     */
    public function create(int $accountId, array $payload, ?string $actorUserId): QcError
    {
        if (isset($payload['heading_id'])) {
            $exists = Heading::query()
                ->where('account_id', $accountId)
                ->where('heading_id', (int) $payload['heading_id'])
                ->exists();

            if (!$exists) {
                throw new RuntimeException('Heading does not belong to this account.');
            }
        }

        $error = QcError::query()->create([
            'account_id' => $accountId,
            'heading_id' => $payload['heading_id'] ?? null,
            'error_category' => $payload['error_category'],
            'comment' => $payload['comment'] ?? null,
            'qc_status' => 'error',
            'rectification_status' => 'Pending',
            'validation_status' => 'Pending',
            'reported_by_user_id' => $actorUserId,
            'reported_at' => now(),
            'resolved_at' => null,
        ]);

        $this->activityLogService->log(
            accountId: $accountId,
            action: 'qc_error.created',
            details: "Created QC error {$error->id}",
            actorUserId: $actorUserId,
            entityType: 'qc_error',
            entityId: $error->id
        );

        $error->load(['heading:heading_id,heading_name', 'reportedBy:userId,username']);

        return $error;
    }

    /**
     * @param array<string, mixed> $payload
     */
    public function update(int $accountId, int $errorId, array $payload, ?string $actorUserId): QcError
    {
        $error = QcError::query()
            ->where('account_id', $accountId)
            ->where('id', $errorId)
            ->with(['heading:heading_id,heading_name', 'reportedBy:userId,username'])
            ->firstOrFail();

        $error->fill($payload);
        $error->save();

        $this->activityLogService->log(
            accountId: $accountId,
            action: 'qc_error.updated',
            details: "Updated QC error {$error->id}",
            actorUserId: $actorUserId,
            entityType: 'qc_error',
            entityId: $error->id
        );

        return $error;
    }

    public function delete(int $accountId, int $errorId, ?string $actorUserId): void
    {
        $error = QcError::query()
            ->where('account_id', $accountId)
            ->where('id', $errorId)
            ->firstOrFail();

        $deletedId = (int) $error->id;
        $error->delete();

        $this->activityLogService->log(
            accountId: $accountId,
            action: 'qc_error.deleted',
            details: "Deleted QC error {$deletedId}",
            actorUserId: $actorUserId,
            entityType: 'qc_error',
            entityId: $deletedId
        );
    }
}
