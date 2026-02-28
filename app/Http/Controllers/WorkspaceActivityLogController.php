<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ResolvesWorkspaceAccount;
use App\Http\Resources\ActivityLogResource;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class WorkspaceActivityLogController extends Controller
{
    use ResolvesWorkspaceAccount;

    public function index(Request $request, string $accountCode)
    {
        $account = $this->resolveAccount($accountCode);
        $validated = $request->validate([
            'entity_type' => ['nullable', Rule::in(['pdm', 'heading', 'qc_error', 'import_batch', 'existing_heading_snapshot'])],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 50);

        $query = ActivityLog::query()
            ->where('account_id', $account->account_id)
            ->with('actor:userId,username')
            ->orderByDesc('created_at');

        if (isset($validated['entity_type'])) {
            $query->where('entity_type', $validated['entity_type']);
        }

        $paginated = $query->paginate($perPage);

        return response()->json([
            'activityLogs' => ActivityLogResource::collection($paginated->items()),
            'meta' => [
                'currentPage' => $paginated->currentPage(),
                'lastPage' => $paginated->lastPage(),
                'perPage' => $paginated->perPage(),
                'total' => $paginated->total(),
            ],
        ]);
    }
}
