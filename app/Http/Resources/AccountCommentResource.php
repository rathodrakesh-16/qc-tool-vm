<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AccountCommentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $currentUser = $request->user();
        $isOwner = $currentUser && $currentUser->userId === $this->user_id;
        $isAdmin = $currentUser && $currentUser->role === 'admin';
        $edited = $this->updated_at && $this->created_at
            && $this->updated_at->gt($this->created_at);

        return [
            'id' => (int) $this->id,
            'text' => $this->text,
            'user' => $this->user?->username ?? null,
            'userId' => $this->user_id,
            'timestamp' => optional($this->created_at)->toISOString(),
            'editedAt' => $edited ? $this->updated_at->toISOString() : null,
            'canEdit' => (bool) $isOwner,
            'canDelete' => (bool) ($isOwner || $isAdmin),
        ];
    }
}
