<?php

namespace App\Domain\Workspace;

use App\Models\Heading;
use App\Models\Pdm;
use App\Models\PdmHeading;
use App\Models\PdmStatusEvent;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class PdmService
{
    public function __construct(
        private readonly ActivityLogService $activityLogService,
        private readonly PdmIdGenerator $pdmIdGenerator
    ) {
    }

    /**
     * @param array<string, mixed> $payload
     */
    public function create(int $accountId, array $payload, ?string $actorUserId): Pdm
    {
        return DB::transaction(function () use ($accountId, $payload, $actorUserId): Pdm {
            $headingRows = $payload['heading_ids'];
            $headingIds = collect($headingRows)->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
            $this->assertAccountHeadings($accountId, $headingIds);

            $pdmId = isset($payload['pdm_id'])
                ? (int) $payload['pdm_id']
                : $this->pdmIdGenerator->generate();

            $pdm = Pdm::query()->create([
                'pdm_id' => $pdmId,
                'account_id' => $accountId,
                'is_copro' => (bool) $payload['is_copro'],
                'url' => $payload['url'] ?? null,
                'company_type' => $payload['company_type'],
                'type_of_proof' => $payload['type_of_proof'] ?? null,
                'description' => trim((string) $payload['description']),
                'comment' => $payload['comment'] ?? null,
                'word_count' => $this->resolveWordCount($payload),
                'uploaded' => false,
                'qc_status' => 'pending',
                'rectification_status' => 'Not Needed',
                'validation_status' => 'Pending',
                'is_qc_edited' => false,
                'is_description_updated' => false,
                'created_by_user_id' => $actorUserId,
                'updated_by_user_id' => $actorUserId,
            ]);

            $this->syncPdmHeadings($pdm, $headingRows);

            Heading::query()
                ->whereIn('heading_id', $headingIds)
                ->update([
                    'workflow_stage' => 'assigned',
                    'updated_by_user_id' => $actorUserId,
                ]);

            $this->recordStatusEvent($pdm->pdm_id, 'created', null, $this->statusSnapshot($pdm), $actorUserId);

            $this->activityLogService->log(
                accountId: $accountId,
                action: 'pdm.created',
                details: "Created PDM {$pdm->pdm_id}",
                actorUserId: $actorUserId,
                entityType: 'pdm',
                entityId: $pdm->pdm_id
            );

            return $this->loadPdmRelations($pdm);
        });
    }

    /**
     * @param array<string, mixed> $payload
     */
    public function update(int $accountId, int $pdmId, array $payload, ?string $actorUserId): Pdm
    {
        return DB::transaction(function () use ($accountId, $pdmId, $payload, $actorUserId): Pdm {
            $pdm = $this->resolvePdm($accountId, $pdmId);
            $fromState = $this->statusSnapshot($pdm);

            $fillable = [];
            foreach (['url', 'type_of_proof', 'description', 'comment'] as $field) {
                if (array_key_exists($field, $payload)) {
                    $fillable[$field] = is_string($payload[$field]) ? trim($payload[$field]) : $payload[$field];
                }
            }

            if (array_key_exists('is_copro', $payload)) {
                $fillable['is_copro'] = (bool) $payload['is_copro'];
            }

            if (array_key_exists('company_type', $payload)) {
                $fillable['company_type'] = $payload['company_type'];
            }

            if (array_key_exists('word_count', $payload) || array_key_exists('description', $payload)) {
                $fillable['word_count'] = $this->resolveWordCount($payload, $pdm->description);
            }

            if ($fillable !== []) {
                $pdm->fill($fillable);
                $pdm->updated_by_user_id = $actorUserId;
                $pdm->save();
            }

            if (isset($payload['heading_ids'])) {
                $existingHeadingIds = $pdm->pdmHeadings()->pluck('heading_id')->map(fn ($id) => (int) $id)->values()->all();
                $newHeadingRows = $payload['heading_ids'];
                $newHeadingIds = collect($newHeadingRows)->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
                $this->assertAccountHeadings($accountId, $newHeadingIds);

                $this->syncPdmHeadings($pdm, $newHeadingRows);

                Heading::query()
                    ->whereIn('heading_id', $newHeadingIds)
                    ->update([
                        'workflow_stage' => 'assigned',
                        'updated_by_user_id' => $actorUserId,
                    ]);

                $removed = array_values(array_diff($existingHeadingIds, $newHeadingIds));
                $this->revertUnlinkedHeadings($removed, $accountId, $actorUserId);
            }

            $pdm = $pdm->fresh();
            if ($pdm === null) {
                throw new RuntimeException('Updated PDM could not be reloaded.');
            }

            $this->recordStatusEvent(
                $pdm->pdm_id,
                'updated',
                $fromState,
                $this->statusSnapshot($pdm),
                $actorUserId
            );

            $this->activityLogService->log(
                accountId: $accountId,
                action: 'pdm.updated',
                details: "Updated PDM {$pdm->pdm_id}",
                actorUserId: $actorUserId,
                entityType: 'pdm',
                entityId: $pdm->pdm_id
            );

            return $this->loadPdmRelations($pdm);
        });
    }

    public function delete(int $accountId, int $pdmId, ?string $actorUserId): void
    {
        DB::transaction(function () use ($accountId, $pdmId, $actorUserId): void {
            $pdm = $this->resolvePdm($accountId, $pdmId);
            $headingIds = $pdm->pdmHeadings()->pluck('heading_id')->map(fn ($id) => (int) $id)->values()->all();
            $deletedPdmId = (int) $pdm->pdm_id;
            $fromState = $this->statusSnapshot($pdm);

            $this->recordStatusEvent(
                $deletedPdmId,
                'deleted',
                $fromState,
                null,
                $actorUserId
            );

            $pdm->delete();
            $this->revertUnlinkedHeadings($headingIds, $accountId, $actorUserId);

            $this->activityLogService->log(
                accountId: $accountId,
                action: 'pdm.deleted',
                details: "Deleted PDM {$deletedPdmId}",
                actorUserId: $actorUserId,
                entityType: 'pdm',
                entityId: $deletedPdmId
            );
        });
    }

    public function updateUploaded(int $accountId, int $pdmId, bool $uploaded, ?string $actorUserId): Pdm
    {
        return DB::transaction(function () use ($accountId, $pdmId, $uploaded, $actorUserId): Pdm {
            $pdm = $this->resolvePdm($accountId, $pdmId);
            $fromState = $this->statusSnapshot($pdm);
            $pdm->uploaded = $uploaded;
            $pdm->updated_by_user_id = $actorUserId;
            $pdm->save();

            $this->recordStatusEvent(
                $pdm->pdm_id,
                'published_status_changed',
                $fromState,
                $this->statusSnapshot($pdm),
                $actorUserId
            );

            $this->activityLogService->log(
                accountId: $accountId,
                action: 'pdm.uploaded_status_changed',
                details: "Updated uploaded status for PDM {$pdm->pdm_id} to ".($pdm->uploaded ? 'true' : 'false'),
                actorUserId: $actorUserId,
                entityType: 'pdm',
                entityId: $pdm->pdm_id
            );

            return $this->loadPdmRelations($pdm);
        });
    }

    public function updateQcStatus(int $accountId, int $pdmId, string $qcStatus, ?string $actorUserId): Pdm
    {
        return DB::transaction(function () use ($accountId, $pdmId, $qcStatus, $actorUserId): Pdm {
            $pdm = $this->resolvePdm($accountId, $pdmId);
            $fromState = $this->statusSnapshot($pdm);
            $pdm->qc_status = $qcStatus;
            $pdm->updated_by_user_id = $actorUserId;
            $pdm->save();

            $this->recordStatusEvent(
                $pdm->pdm_id,
                'qc_status_changed',
                $fromState,
                $this->statusSnapshot($pdm),
                $actorUserId
            );

            $this->activityLogService->log(
                accountId: $accountId,
                action: 'pdm.qc_status_changed',
                details: "Updated QC status for PDM {$pdm->pdm_id} to {$pdm->qc_status}",
                actorUserId: $actorUserId,
                entityType: 'pdm',
                entityId: $pdm->pdm_id
            );

            return $this->loadPdmRelations($pdm);
        });
    }

    public function updateRectification(int $accountId, int $pdmId, string $rectificationStatus, ?string $actorUserId): Pdm
    {
        return DB::transaction(function () use ($accountId, $pdmId, $rectificationStatus, $actorUserId): Pdm {
            $pdm = $this->resolvePdm($accountId, $pdmId);
            $fromState = $this->statusSnapshot($pdm);
            $pdm->rectification_status = $rectificationStatus;
            $pdm->updated_by_user_id = $actorUserId;
            $pdm->save();

            $this->recordStatusEvent(
                $pdm->pdm_id,
                'rectification_status_changed',
                $fromState,
                $this->statusSnapshot($pdm),
                $actorUserId
            );

            $this->activityLogService->log(
                accountId: $accountId,
                action: 'pdm.rectification_status_changed',
                details: "Updated rectification status for PDM {$pdm->pdm_id} to {$pdm->rectification_status}",
                actorUserId: $actorUserId,
                entityType: 'pdm',
                entityId: $pdm->pdm_id
            );

            return $this->loadPdmRelations($pdm);
        });
    }

    public function updateValidation(int $accountId, int $pdmId, string $validationStatus, ?string $actorUserId): Pdm
    {
        return DB::transaction(function () use ($accountId, $pdmId, $validationStatus, $actorUserId): Pdm {
            $pdm = $this->resolvePdm($accountId, $pdmId);
            $fromState = $this->statusSnapshot($pdm);
            $pdm->validation_status = $validationStatus;
            $pdm->updated_by_user_id = $actorUserId;
            $pdm->save();

            $this->recordStatusEvent(
                $pdm->pdm_id,
                'validation_status_changed',
                $fromState,
                $this->statusSnapshot($pdm),
                $actorUserId
            );

            $this->activityLogService->log(
                accountId: $accountId,
                action: 'pdm.validation_status_changed',
                details: "Updated validation status for PDM {$pdm->pdm_id} to {$pdm->validation_status}",
                actorUserId: $actorUserId,
                entityType: 'pdm',
                entityId: $pdm->pdm_id
            );

            return $this->loadPdmRelations($pdm);
        });
    }

    /**
     * @param array<string, mixed> $validated
     */
    private function resolveWordCount(array $validated, ?string $fallbackDescription = null): int
    {
        if (isset($validated['word_count'])) {
            return (int) $validated['word_count'];
        }

        $description = isset($validated['description']) ? (string) $validated['description'] : (string) $fallbackDescription;
        $description = trim($description);

        if ($description === '') {
            return 0;
        }

        return count(preg_split('/\s+/', $description) ?: []);
    }

    /**
     * @param array<int, int> $headingIds
     */
    private function assertAccountHeadings(int $accountId, array $headingIds): void
    {
        $existingCount = Heading::query()
            ->where('account_id', $accountId)
            ->whereIn('heading_id', $headingIds)
            ->count();

        if ($existingCount !== count($headingIds)) {
            throw new RuntimeException('One or more headings do not belong to this account.');
        }
    }

    /**
     * @param array<int, array{id:int, sort_order:int}> $headingRows
     */
    private function syncPdmHeadings(Pdm $pdm, array $headingRows): void
    {
        PdmHeading::query()->where('pdm_id', $pdm->pdm_id)->delete();

        foreach ($headingRows as $row) {
            PdmHeading::query()->create([
                'pdm_id' => $pdm->pdm_id,
                'heading_id' => (int) $row['id'],
                'sort_order' => (int) $row['sort_order'],
            ]);
        }
    }

    /**
     * @param array<int, int> $headingIds
     */
    private function revertUnlinkedHeadings(array $headingIds, int $accountId, ?string $actorUserId): void
    {
        if ($headingIds === []) {
            return;
        }

        foreach ($headingIds as $headingId) {
            $isStillUsed = PdmHeading::query()
                ->where('heading_id', $headingId)
                ->whereIn('pdm_id', function ($query) use ($accountId): void {
                    $query->select('pdm_id')
                        ->from('pdms')
                        ->where('account_id', $accountId);
                })
                ->exists();

            if ($isStillUsed) {
                continue;
            }

            $heading = Heading::query()
                ->where('account_id', $accountId)
                ->where('heading_id', $headingId)
                ->first();

            if ($heading === null) {
                continue;
            }

            $heading->workflow_stage = $heading->supported_link ? 'supported' : 'imported';
            $heading->updated_by_user_id = $actorUserId;
            $heading->save();
        }
    }

    private function resolvePdm(int $accountId, int $pdmId): Pdm
    {
        return Pdm::query()
            ->where('account_id', $accountId)
            ->where('pdm_id', $pdmId)
            ->with('pdmHeadings')
            ->firstOrFail();
    }

    /**
     * @return array<string, mixed>
     */
    private function statusSnapshot(Pdm $pdm): array
    {
        return [
            'uploaded' => (bool) $pdm->uploaded,
            'qc_status' => $pdm->qc_status,
            'rectification_status' => $pdm->rectification_status,
            'validation_status' => $pdm->validation_status,
        ];
    }

    /**
     * @param array<string, mixed>|null $fromState
     * @param array<string, mixed>|null $toState
     */
    private function recordStatusEvent(
        int $pdmId,
        string $eventType,
        ?array $fromState,
        ?array $toState,
        ?string $actorUserId
    ): void {
        if (!in_array($eventType, [
            'created',
            'updated',
            'deleted',
            'qc_feedback_submitted',
            'qc_status_changed',
            'rectification_status_changed',
            'validation_status_changed',
            'published_status_changed',
        ], true)) {
            throw new RuntimeException("Unsupported status event type: {$eventType}");
        }

        PdmStatusEvent::query()->create([
            'pdm_id' => $pdmId,
            'event_type' => $eventType,
            'from_state' => $fromState,
            'to_state' => $toState,
            'actor_user_id' => $actorUserId,
            'created_at' => now(),
        ]);
    }

    private function loadPdmRelations(Pdm $pdm): Pdm
    {
        $pdm->load([
            'pdmHeadings.heading:heading_id,heading_name',
            'qcFeedback.errors',
            'qcFeedback.feedbackUser:userId,username',
        ]);

        return $pdm;
    }
}
