<?php

namespace App\Http\Resources;

use App\Domain\Dashboard\AccountIdFormatter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AccountDataFileResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $accountCode = AccountIdFormatter::toDisplay((int) $this->account_id);

        return [
            'id' => (int) $this->id,
            'name' => $this->original_name,
            'size' => (int) $this->size,
            'type' => $this->file_type,
            'mimeType' => $this->mime_type,
            'uploadedAt' => optional($this->created_at)->toISOString(),
            'uploadedBy' => $this->uploadedBy?->username ?? null,
            'canDelete' => (bool) $request->user(),
            'downloadUrl' => "/api/dashboard/accounts/{$accountCode}/files/{$this->id}/download",
            'previewUrl' => "/api/dashboard/accounts/{$accountCode}/files/{$this->id}/preview",
        ];
    }
}
