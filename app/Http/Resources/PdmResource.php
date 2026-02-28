<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PdmResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $headings = $this->relationLoaded('pdmHeadings')
            ? $this->pdmHeadings
                ->sortBy('sort_order')
                ->map(function ($pdmHeading): array {
                    return [
                        'id' => (int) $pdmHeading->heading_id,
                        'sortOrder' => (int) $pdmHeading->sort_order,
                        'headingName' => $pdmHeading->heading?->heading_name,
                    ];
                })
                ->values()
                ->all()
            : [];

        return [
            'pdmId' => (int) $this->pdm_id,
            'accountId' => (int) $this->account_id,
            'isCopro' => (bool) $this->is_copro,
            'url' => $this->url,
            'companyType' => $this->company_type,
            'typeOfProof' => $this->type_of_proof,
            'description' => $this->description,
            'comment' => $this->comment,
            'wordCount' => (int) $this->word_count,
            'uploaded' => (bool) $this->uploaded,
            'qcStatus' => $this->qc_status,
            'rectificationStatus' => $this->rectification_status,
            'validationStatus' => $this->validation_status,
            'isQcEdited' => (bool) $this->is_qc_edited,
            'isDescriptionUpdated' => (bool) $this->is_description_updated,
            'headings' => $headings,
            'feedback' => $this->whenLoaded('qcFeedback', function (): ?array {
                if ($this->qcFeedback === null) {
                    return null;
                }

                return (new PdmQcFeedbackResource($this->qcFeedback))->toArray(request());
            }),
            'createdAt' => optional($this->created_at)->toISOString(),
            'updatedAt' => optional($this->updated_at)->toISOString(),
        ];
    }
}

