<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class QcErrorResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => (int) $this->id,
            'accountId' => (int) $this->account_id,
            'headingId' => $this->heading_id !== null ? (int) $this->heading_id : null,
            'headingName' => $this->heading?->heading_name,
            'errorCategory' => $this->error_category,
            'comment' => $this->comment,
            'qcStatus' => $this->qc_status,
            'rectificationStatus' => $this->rectification_status,
            'validationStatus' => $this->validation_status,
            'reportedBy' => $this->reportedBy?->username,
            'reportedAt' => optional($this->reported_at)->toISOString(),
            'resolvedAt' => optional($this->resolved_at)->toISOString(),
            'createdAt' => optional($this->created_at)->toISOString(),
            'updatedAt' => optional($this->updated_at)->toISOString(),
        ];
    }
}

