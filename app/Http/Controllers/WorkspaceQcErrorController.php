<?php

namespace App\Http\Controllers;

use App\Domain\Workspace\QcErrorService;
use App\Http\Controllers\Concerns\ResolvesWorkspaceAccount;
use App\Http\Resources\QcErrorResource;
use App\Models\QcError;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

class WorkspaceQcErrorController extends Controller
{
    use ResolvesWorkspaceAccount;

    public function __construct(
        private readonly QcErrorService $qcErrorService
    ) {
    }

    public function index(Request $request, string $accountCode)
    {
        $account = $this->resolveAccount($accountCode);
        $validated = $request->validate([
            'rectification_status' => ['nullable', Rule::in(['Pending', 'Done', 'Not Needed'])],
            'validation_status' => ['nullable', Rule::in(['Pending', 'Done'])],
        ]);

        $query = QcError::query()
            ->where('account_id', $account->account_id)
            ->with(['heading:heading_id,heading_name', 'reportedBy:userId,username'])
            ->orderByDesc('reported_at');

        if (isset($validated['rectification_status'])) {
            $query->where('rectification_status', $validated['rectification_status']);
        }

        if (isset($validated['validation_status'])) {
            $query->where('validation_status', $validated['validation_status']);
        }

        $errors = $query->get();

        return response()->json([
            'errors' => QcErrorResource::collection($errors),
        ]);
    }

    public function store(Request $request, string $accountCode)
    {
        $account = $this->resolveAccount($accountCode);
        $validated = $request->validate([
            'heading_id' => ['nullable', 'integer', 'min:1'],
            'error_category' => ['required', 'string', 'max:255'],
            'comment' => ['nullable', 'string', 'max:65535'],
        ]);

        $validated['error_category'] = trim((string) $validated['error_category']);
        if ($validated['error_category'] === '') {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => ['error_category' => ['Error category cannot be blank.']],
            ], 422);
        }

        try {
            $error = $this->qcErrorService->create(
                accountId: (int) $account->account_id,
                payload: $validated,
                actorUserId: $request->user()?->userId
            );
        } catch (RuntimeException $runtimeException) {
            if ($runtimeException->getMessage() === 'Heading does not belong to this account.') {
                return response()->json([
                    'message' => 'Validation failed',
                    'errors' => ['heading_id' => ['Heading does not belong to this account.']],
                ], 422);
            }

            throw $runtimeException;
        }

        return response()->json([
            'error' => (new QcErrorResource($error))->toArray($request),
        ], 201);
    }

    public function update(Request $request, string $accountCode, string $errorId)
    {
        $account = $this->resolveAccount($accountCode);
        if (!preg_match('/^\d+$/', $errorId)) {
            abort(404);
        }

        $validated = $request->validate([
            'rectification_status' => ['sometimes', Rule::in(['Pending', 'Done', 'Not Needed'])],
            'validation_status' => ['sometimes', Rule::in(['Pending', 'Done'])],
            'qc_status' => ['sometimes', Rule::in(['pending', 'checked', 'error'])],
            'resolved_at' => ['sometimes', 'nullable', 'date'],
            'comment' => ['sometimes', 'nullable', 'string', 'max:65535'],
        ]);

        $error = $this->qcErrorService->update(
            accountId: (int) $account->account_id,
            errorId: (int) $errorId,
            payload: $validated,
            actorUserId: $request->user()?->userId
        );

        return response()->json([
            'error' => (new QcErrorResource($error))->toArray($request),
        ]);
    }

    public function destroy(Request $request, string $accountCode, string $errorId)
    {
        $account = $this->resolveAccount($accountCode);
        if (!preg_match('/^\d+$/', $errorId)) {
            abort(404);
        }
        $this->qcErrorService->delete(
            accountId: (int) $account->account_id,
            errorId: (int) $errorId,
            actorUserId: $request->user()?->userId
        );

        return response()->noContent();
    }
}
