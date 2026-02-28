<?php

namespace App\Http\Resources;

use App\Domain\Dashboard\AccountIdFormatter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AccountResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => AccountIdFormatter::toDisplay((int) $this->account_id),
            'name' => $this->account_name,
            'editor' => $this->editorUser?->username ?? '',
            'qc' => $this->qcUser?->username ?? '',
            'editorUserId' => $this->editor_user_id,
            'qcUserId' => $this->qc_user_id,
            'status' => $this->status,
            'assignedDate' => $this->assigned_date?->format('Y-m-d'),
            'deliveryDate' => $this->delivery_date?->format('Y-m-d'),
            'isSystem' => (bool) $this->is_system,
            'createdAt' => optional($this->created_at)->toISOString(),
            'updatedAt' => optional($this->updated_at)->toISOString(),
        ];
    }
}
