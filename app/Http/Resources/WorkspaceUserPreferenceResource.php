<?php

namespace App\Http\Resources;

use App\Domain\Dashboard\AccountIdFormatter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WorkspaceUserPreferenceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'userId' => $this->user_id,
            'lastAccountId' => $this->last_account_id !== null
                ? AccountIdFormatter::toDisplay((int) $this->last_account_id)
                : null,
            'activeMode' => $this->active_mode,
            'activeRoute' => $this->active_route,
            'filters' => $this->filters_json ?? [],
            'updatedAt' => optional($this->updated_at)->toISOString(),
        ];
    }
}

