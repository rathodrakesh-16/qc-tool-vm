<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ExistingHeadingSnapshotResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => (int) $this->id,
            'accountId' => (int) $this->account_id,
            'fileName' => $this->file_name,
            'uploadedBy' => $this->uploadedBy?->username,
            'uploadedAt' => optional($this->uploaded_at)->toISOString(),
            'isActive' => (bool) $this->is_active,
            'itemsCount' => $this->whenCounted('items'),
        ];
    }
}

