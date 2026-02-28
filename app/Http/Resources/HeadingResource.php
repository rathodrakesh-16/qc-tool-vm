<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class HeadingResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'headingId' => (int) $this->heading_id,
            'accountId' => (int) $this->account_id,
            'headingName' => $this->heading_name,
            'families' => $this->whenLoaded(
                'families',
                fn (): array => $this->families->pluck('family_name')->values()->all(),
                []
            ),
            'familiesJson' => $this->families_json,
            'groupingFamily' => $this->grouping_family,
            'supportedLink' => $this->supported_link,
            'workflowStage' => $this->workflow_stage,
            'status' => $this->status,
            'rankPoints' => $this->rank_points,
            'headingType' => $this->heading_type,
            'sourceStatus' => $this->source_status,
            'sourceUpdatedAt' => $this->source_updated_at,
            'definition' => $this->definition,
            'aliases' => $this->aliases,
            'category' => $this->category,
            'companies' => $this->companies,
            'createdAt' => optional($this->created_at)->toISOString(),
            'updatedAt' => optional($this->updated_at)->toISOString(),
        ];
    }
}

