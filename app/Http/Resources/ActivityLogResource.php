<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ActivityLogResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => (int) $this->id,
            'accountId' => (int) $this->account_id,
            'action' => $this->action,
            'details' => $this->details,
            'entityType' => $this->entity_type,
            'entityId' => $this->entity_id,
            'actorUserId' => $this->actor_user_id,
            'actor' => $this->actor?->username,
            'createdAt' => optional($this->created_at)->toISOString(),
        ];
    }
}

