<?php

namespace App\Http\Controllers;

use App\Domain\Workspace\PdmService;
use App\Http\Controllers\Concerns\ResolvesWorkspaceAccount;
use App\Http\Resources\PdmResource;
use App\Models\Pdm;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

class WorkspacePdmController extends Controller
{
    use ResolvesWorkspaceAccount;

    public function __construct(
        private readonly PdmService $pdmService
    ) {
    }

    public function index(Request $request, string $accountCode)
    {
        $account = $this->resolveAccount($accountCode);

        $validated = $request->validate([
            'qc_status' => ['nullable', Rule::in(['pending', 'checked', 'error'])],
            'uploaded' => ['nullable', 'boolean'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 50);

        $query = Pdm::query()
            ->where('account_id', $account->account_id)
            ->with([
                'pdmHeadings.heading:heading_id,heading_name',
                'qcFeedback.errors',
                'qcFeedback.feedbackUser:userId,username',
            ])
            ->orderByDesc('created_at');

        if (isset($validated['qc_status'])) {
            $query->where('qc_status', $validated['qc_status']);
        }

        if (array_key_exists('uploaded', $validated)) {
            $query->where('uploaded', (bool) $validated['uploaded']);
        }

        $paginated = $query->paginate($perPage);

        return response()->json([
            'pdms' => PdmResource::collection($paginated->items()),
            'meta' => [
                'currentPage' => $paginated->currentPage(),
                'lastPage' => $paginated->lastPage(),
                'perPage' => $paginated->perPage(),
                'total' => $paginated->total(),
            ],
        ]);
    }

    public function store(Request $request, string $accountCode)
    {
        $account = $this->resolveAccount($accountCode);
        $validated = $this->validatePdmPayload($request, true);

        $actorUserId = $request->user()?->userId;
        try {
            $pdm = $this->pdmService->create(
                accountId: (int) $account->account_id,
                payload: $validated,
                actorUserId: $actorUserId
            );
        } catch (QueryException $queryException) {
            if ($queryException->getCode() === '23505') {
                return response()->json([
                    'message' => 'Validation failed',
                    'errors' => ['pdm_id' => ['A PDM with this id already exists.']],
                ], 422);
            }

            throw $queryException;
        } catch (RuntimeException $runtimeException) {
            if ($runtimeException->getMessage() === 'One or more headings do not belong to this account.') {
                return response()->json([
                    'message' => 'Validation failed',
                    'errors' => ['heading_ids' => ['One or more headings do not belong to this account.']],
                ], 422);
            }

            throw $runtimeException;
        }

        return response()->json([
            'pdm' => (new PdmResource($pdm))->toArray($request),
        ], 201);
    }

    public function update(Request $request, string $accountCode, string $pdmId)
    {
        $account = $this->resolveAccount($accountCode);
        if (!preg_match('/^\d+$/', $pdmId)) {
            abort(404);
        }
        $validated = $this->validatePdmPayload($request, false);
        $actorUserId = $request->user()?->userId;

        try {
            $pdm = $this->pdmService->update(
                accountId: (int) $account->account_id,
                pdmId: (int) $pdmId,
                payload: $validated,
                actorUserId: $actorUserId
            );
        } catch (RuntimeException $runtimeException) {
            if ($runtimeException->getMessage() === 'One or more headings do not belong to this account.') {
                return response()->json([
                    'message' => 'Validation failed',
                    'errors' => ['heading_ids' => ['One or more headings do not belong to this account.']],
                ], 422);
            }

            throw $runtimeException;
        }

        return response()->json([
            'pdm' => (new PdmResource($pdm))->toArray($request),
        ]);
    }

    public function destroy(Request $request, string $accountCode, string $pdmId)
    {
        $account = $this->resolveAccount($accountCode);
        if (!preg_match('/^\d+$/', $pdmId)) {
            abort(404);
        }
        $actorUserId = $request->user()?->userId;

        $this->pdmService->delete(
            accountId: (int) $account->account_id,
            pdmId: (int) $pdmId,
            actorUserId: $actorUserId
        );

        return response()->noContent();
    }

    public function updateUploaded(Request $request, string $accountCode, string $pdmId)
    {
        $account = $this->resolveAccount($accountCode);
        if (!preg_match('/^\d+$/', $pdmId)) {
            abort(404);
        }
        $validated = $request->validate([
            'uploaded' => ['required', 'boolean'],
        ]);

        $pdm = $this->pdmService->updateUploaded(
            accountId: (int) $account->account_id,
            pdmId: (int) $pdmId,
            uploaded: (bool) $validated['uploaded'],
            actorUserId: $request->user()?->userId
        );

        return response()->json([
            'pdm' => (new PdmResource($pdm))->toArray($request),
        ]);
    }

    public function updateQcStatus(Request $request, string $accountCode, string $pdmId)
    {
        $account = $this->resolveAccount($accountCode);
        if (!preg_match('/^\d+$/', $pdmId)) {
            abort(404);
        }
        $validated = $request->validate([
            'qc_status' => ['required', Rule::in(['pending', 'checked', 'error'])],
        ]);

        $pdm = $this->pdmService->updateQcStatus(
            accountId: (int) $account->account_id,
            pdmId: (int) $pdmId,
            qcStatus: $validated['qc_status'],
            actorUserId: $request->user()?->userId
        );

        return response()->json([
            'pdm' => (new PdmResource($pdm))->toArray($request),
        ]);
    }

    public function updateRectification(Request $request, string $accountCode, string $pdmId)
    {
        $account = $this->resolveAccount($accountCode);
        if (!preg_match('/^\d+$/', $pdmId)) {
            abort(404);
        }
        $validated = $request->validate([
            'rectification_status' => ['required', Rule::in(['Pending', 'Done', 'Not Needed'])],
        ]);

        $pdm = $this->pdmService->updateRectification(
            accountId: (int) $account->account_id,
            pdmId: (int) $pdmId,
            rectificationStatus: $validated['rectification_status'],
            actorUserId: $request->user()?->userId
        );

        return response()->json([
            'pdm' => (new PdmResource($pdm))->toArray($request),
        ]);
    }

    public function updateValidation(Request $request, string $accountCode, string $pdmId)
    {
        $account = $this->resolveAccount($accountCode);
        if (!preg_match('/^\d+$/', $pdmId)) {
            abort(404);
        }
        $validated = $request->validate([
            'validation_status' => ['required', Rule::in(['Pending', 'Done'])],
        ]);

        $pdm = $this->pdmService->updateValidation(
            accountId: (int) $account->account_id,
            pdmId: (int) $pdmId,
            validationStatus: $validated['validation_status'],
            actorUserId: $request->user()?->userId
        );

        return response()->json([
            'pdm' => (new PdmResource($pdm))->toArray($request),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validatePdmPayload(Request $request, bool $isCreate): array
    {
        $rules = [
            'pdm_id' => [$isCreate ? 'sometimes' : 'prohibited', 'integer', 'min:1'],
            'is_copro' => [$isCreate ? 'required' : 'sometimes', 'boolean'],
            'url' => ['nullable', 'url', 'max:65535'],
            'company_type' => [$isCreate ? 'required' : 'sometimes', 'array', 'min:1'],
            'company_type.*' => ['nullable', 'string', 'max:255'],
            'type_of_proof' => ['nullable', 'string', 'max:255'],
            'description' => [$isCreate ? 'required' : 'sometimes', 'string', 'max:65535'],
            'comment' => ['nullable', 'string', 'max:65535'],
            'word_count' => ['sometimes', 'integer', 'min:0'],
            'heading_ids' => [$isCreate ? 'required' : 'sometimes', 'array', 'min:1', 'max:8'],
            'heading_ids.*.id' => ['required_with:heading_ids', 'integer', 'min:1'],
            'heading_ids.*.sort_order' => ['required_with:heading_ids', 'integer', 'between:1,8'],
        ];

        $validated = $request->validate($rules);
        if (array_key_exists('description', $validated)) {
            $validated['description'] = trim((string) $validated['description']);
        }

        if (($validated['description'] ?? '') === '' && $isCreate) {
            abort(response()->json([
                'message' => 'Validation failed',
                'errors' => ['description' => ['Description cannot be blank.']],
            ], 422));
        }

        if (($validated['is_copro'] ?? false) === false && ($validated['url'] ?? null) === null && $isCreate) {
            abort(response()->json([
                'message' => 'Validation failed',
                'errors' => ['url' => ['URL is required when is_copro is false.']],
            ], 422));
        }

        if (isset($validated['heading_ids'])) {
            $sortOrders = collect($validated['heading_ids'])->pluck('sort_order')->all();
            $headingIds = collect($validated['heading_ids'])->pluck('id')->all();

            if (count($sortOrders) !== count(array_unique($sortOrders))) {
                abort(response()->json([
                    'message' => 'Validation failed',
                    'errors' => ['heading_ids' => ['Sort order values must be unique.']],
                ], 422));
            }

            if (count($headingIds) !== count(array_unique($headingIds))) {
                abort(response()->json([
                    'message' => 'Validation failed',
                    'errors' => ['heading_ids' => ['Heading IDs must be unique.']],
                ], 422));
            }
        }

        return $validated;
    }
}
