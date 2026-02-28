<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PdmFeedbackHistoryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => (int) $this->id,
            'pdmId' => (int) $this->pdm_id,
            'updatedDescription' => $this->updated_description,
            'comment' => $this->comment,
            'errors' => $this->errors_json ?? [],
            'feedbackUserId' => $this->feedback_user_id,
            'feedbackUser' => $this->feedbackUser?->username,
            'feedbackAt' => optional($this->feedback_at)->toISOString(),
        ];
    }
}

