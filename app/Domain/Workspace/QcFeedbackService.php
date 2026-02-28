<?php

namespace App\Domain\Workspace;

use App\Models\Pdm;
use App\Models\PdmFeedbackHistory;
use App\Models\PdmQcFeedback;
use App\Models\PdmQcFeedbackError;
use App\Models\PdmStatusEvent;
use Illuminate\Support\Facades\DB;

class QcFeedbackService
{
    public function __construct(
        private readonly ActivityLogService $activityLogService
    ) {
    }

    /**
     * @param array<string, mixed> $payload
     */
    public function upsert(int $accountId, int $pdmId, array $payload, ?string $actorUserId): PdmQcFeedback
    {
        $pdm = $this->resolvePdm($accountId, $pdmId);

        $errorCategories = collect($payload['error_categories'] ?? [])
            ->map(fn ($value) => trim((string) $value))
            ->filter(fn ($value) => $value !== '')
            ->unique()
            ->values()
            ->all();

        $feedback = DB::transaction(function () use ($payload, $errorCategories, $pdm, $accountId, $actorUserId) {
            $existing = PdmQcFeedback::query()
                ->where('pdm_id', $pdm->pdm_id)
                ->with('errors')
                ->first();

            $fromState = [
                'qc_status' => $pdm->qc_status,
                'is_qc_edited' => (bool) $pdm->is_qc_edited,
                'is_description_updated' => (bool) $pdm->is_description_updated,
            ];

            if ($existing === null) {
                $feedback = PdmQcFeedback::query()->create([
                    'pdm_id' => $pdm->pdm_id,
                    'updated_description' => $payload['updated_description'] ?? null,
                    'comment' => $payload['comment'] ?? null,
                    'feedback_user_id' => $actorUserId,
                    'feedback_at' => now(),
                ]);
            } else {
                $existing->update([
                    'updated_description' => $payload['updated_description'] ?? null,
                    'comment' => $payload['comment'] ?? null,
                    'feedback_user_id' => $actorUserId,
                    'feedback_at' => now(),
                ]);

                $feedback = $existing->fresh();
            }

            PdmQcFeedbackError::query()->where('feedback_id', $feedback->id)->delete();
            foreach ($errorCategories as $category) {
                PdmQcFeedbackError::query()->create([
                    'feedback_id' => $feedback->id,
                    'error_category' => $category,
                ]);
            }

            PdmFeedbackHistory::query()->create([
                'pdm_id' => $pdm->pdm_id,
                'feedback_user_id' => $actorUserId,
                'feedback_at' => now(),
                'updated_description' => $payload['updated_description'] ?? null,
                'comment' => $payload['comment'] ?? null,
                'errors_json' => $errorCategories,
            ]);

            $newQcStatus = $errorCategories === [] ? 'checked' : 'error';
            $updatedDescription = trim((string) ($payload['updated_description'] ?? ''));
            $isDescriptionUpdated = $updatedDescription !== '' && $updatedDescription !== trim((string) $pdm->description);

            $pdm->update([
                'qc_status' => $newQcStatus,
                'is_qc_edited' => true,
                'is_description_updated' => $isDescriptionUpdated,
                'updated_by_user_id' => $actorUserId,
            ]);

            PdmStatusEvent::query()->create([
                'pdm_id' => $pdm->pdm_id,
                'event_type' => 'qc_feedback_submitted',
                'from_state' => $fromState,
                'to_state' => [
                    'qc_status' => $newQcStatus,
                    'is_qc_edited' => true,
                    'is_description_updated' => $isDescriptionUpdated,
                ],
                'actor_user_id' => $actorUserId,
                'created_at' => now(),
            ]);

            $this->activityLogService->log(
                accountId: $accountId,
                action: 'pdm.qc_feedback_submitted',
                details: "Submitted QC feedback for PDM {$pdm->pdm_id}",
                actorUserId: $actorUserId,
                entityType: 'pdm',
                entityId: $pdm->pdm_id
            );

            return $feedback;
        });

        $feedback->load(['errors', 'feedbackUser:userId,username']);

        return $feedback;
    }

    private function resolvePdm(int $accountId, int $pdmId): Pdm
    {
        return Pdm::query()
            ->where('account_id', $accountId)
            ->where('pdm_id', $pdmId)
            ->firstOrFail();
    }
}
