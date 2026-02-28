<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;

class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var User|null $actor */
        $actor = $request->user();
        $canDelete = $actor ? Gate::forUser($actor)->allows('delete', $this->resource) : false;

        return [
            'uuid' => $this->uuid,
            'userId' => $this->userId,
            'username' => $this->username,
            'email' => $this->email,
            'role' => $this->role,
            'designation' => $this->designation,
            'team' => $this->team,
            'department' => $this->department,
            'location' => $this->location,
            'createdAt' => optional($this->created_at)->toISOString(),
            'updatedAt' => optional($this->updated_at)->toISOString(),
            'permissions' => [
                'canDelete' => $canDelete,
            ],
        ];
    }
}
