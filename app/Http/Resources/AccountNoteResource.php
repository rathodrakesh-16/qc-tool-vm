<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AccountNoteResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => (int) $this->id,
            'subject' => $this->subject,
            'content' => $this->content,
            'createdBy' => $this->createdBy?->username ?? null,
            'createdAt' => optional($this->created_at)->toISOString(),
            'updatedAt' => optional($this->updated_at)->toISOString(),
            'canDelete' => (bool) $request->user(),
            'canEdit' => (bool) $request->user(),
        ];
    }
}
