<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PdmQcFeedbackResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $errorCategories = $this->relationLoaded('errors')
            ? $this->errors->pluck('error_category')->values()->all()
            : [];

        return [
            'id' => (int) $this->id,
            'pdmId' => (int) $this->pdm_id,
            'updatedDescription' => $this->updated_description,
            'comment' => $this->comment,
            'errorCategories' => $errorCategories,
            'feedbackUserId' => $this->feedback_user_id,
            'feedbackUser' => $this->feedbackUser?->username,
            'feedbackAt' => optional($this->feedback_at)->toISOString(),
            'createdAt' => optional($this->created_at)->toISOString(),
            'updatedAt' => optional($this->updated_at)->toISOString(),
        ];
    }
}

