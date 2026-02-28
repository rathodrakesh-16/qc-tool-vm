<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ExistingHeadingSnapshotItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => (int) $this->id,
            'snapshotId' => (int) $this->snapshot_id,
            'headingId' => $this->heading_id !== null ? (int) $this->heading_id : null,
            'headingName' => $this->heading_name,
            'rankPoints' => $this->rank_points,
            'definition' => $this->definition,
            'category' => $this->category,
            'family' => $this->family,
            'companyType' => $this->company_type,
            'profileDescription' => $this->profile_description,
            'siteLink' => $this->site_link,
            'quality' => $this->quality,
            'sourceLastUpdated' => $this->source_last_updated,
        ];
    }
}

