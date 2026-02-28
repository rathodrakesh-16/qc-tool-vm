<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ImportBatchResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => (int) $this->id,
            'accountId' => (int) $this->account_id,
            'contextFamily' => $this->context_family,
            'fileName' => $this->file_name,
            'headingsCount' => (int) $this->headings_count,
            'importedBy' => $this->importedBy?->username,
            'importedAt' => optional($this->imported_at)->toISOString(),
            'itemsCount' => $this->whenCounted('items'),
        ];
    }
}

