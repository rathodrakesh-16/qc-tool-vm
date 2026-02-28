<?php

namespace App\Http\Controllers;

use App\Domain\Workspace\WorkspacePreferenceService;
use App\Http\Resources\WorkspaceUserPreferenceResource;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

class WorkspacePreferenceController extends Controller
{
    public function __construct(
        private readonly WorkspacePreferenceService $workspacePreferenceService
    ) {
    }

    public function show(Request $request)
    {
        $user = $request->user();
        abort_if($user === null, 401);

        $preferences = $this->workspacePreferenceService->showForUser(
            $user
        );

        return response()->json([
            'preferences' => (new WorkspaceUserPreferenceResource($preferences))->toArray($request),
        ]);
    }

    public function update(Request $request)
    {
        $user = $request->user();
        abort_if($user === null, 401);

        $validated = $request->validate([
            'last_account_id' => ['sometimes', 'nullable'],
            'active_mode' => ['sometimes', Rule::in(['editor', 'qc'])],
            'active_route' => ['sometimes', Rule::in([
                'production',
                'account_data',
                'production_report',
                'qc_review',
                'qc_report',
            ])],
            'filters_json' => ['sometimes', 'nullable', 'array'],
        ]);

        try {
            $preferences = $this->workspacePreferenceService->updateForUser($user, $validated);
        } catch (RuntimeException $runtimeException) {
            if ($runtimeException->getMessage() === 'Invalid account id format.') {
                return response()->json([
                    'message' => 'Validation failed',
                    'errors' => ['last_account_id' => ['Invalid account id format.']],
                ], 422);
            }
            if ($runtimeException->getMessage() === 'Account not found.') {
                return response()->json([
                    'message' => 'Validation failed',
                    'errors' => ['last_account_id' => ['Account not found.']],
                ], 422);
            }

            throw $runtimeException;
        }

        return response()->json([
            'preferences' => (new WorkspaceUserPreferenceResource($preferences))->toArray($request),
        ]);
    }
}
