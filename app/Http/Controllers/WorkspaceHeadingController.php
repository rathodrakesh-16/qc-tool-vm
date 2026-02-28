<?php

namespace App\Http\Controllers;

use App\Domain\Workspace\ActivityLogService;
use App\Domain\Workspace\HeadingImportService;
use App\Http\Controllers\Concerns\ResolvesWorkspaceAccount;
use App\Http\Resources\HeadingResource;
use App\Http\Resources\ImportBatchResource;
use App\Models\Heading;
use App\Models\HeadingFamily;
use App\Models\ImportBatch;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Rule;
use RuntimeException;

class WorkspaceHeadingController extends Controller
{
    use ResolvesWorkspaceAccount;

    public function __construct(
        private readonly ActivityLogService $activityLogService,
        private readonly HeadingImportService $headingImportService
    ) {
    }

    public function index(Request $request, string $accountCode)
    {
        $account = $this->resolveAccount($accountCode);

        $validated = $request->validate([
            'workflow_stage' => ['nullable', Rule::in(['imported', 'supported', 'assigned'])],
            'family' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', Rule::in(['existing', 'ranked', 'additional'])],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 50);

        $query = Heading::query()
            ->where('account_id', $account->account_id)
            ->with(['families'])
            ->orderBy('heading_name');

        if (isset($validated['workflow_stage'])) {
            $query->where('workflow_stage', $validated['workflow_stage']);
        }

        if (isset($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        if (!empty($validated['family'])) {
            $family = trim((string) $validated['family']);
            $query->whereHas('families', function ($familyQuery) use ($family): void {
                $familyQuery->where('family_name', $family);
            });
        }

        $paginated = $query->paginate($perPage);

        return response()->json([
            'headings' => HeadingResource::collection($paginated->items()),
            'meta' => [
                'currentPage' => $paginated->currentPage(),
                'lastPage' => $paginated->lastPage(),
                'perPage' => $paginated->perPage(),
                'total' => $paginated->total(),
            ],
        ]);
    }

    public function import(Request $request, string $accountCode)
    {
        $account = $this->resolveAccount($accountCode);

        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv'],
            'context_family' => ['nullable', 'string', 'max:255'],
        ]);

        /** @var UploadedFile $file */
        $file = $validated['file'];
        $contextFamily = isset($validated['context_family']) ? trim((string) $validated['context_family']) : null;
        $actorUserId = $request->user()?->userId;
        try {
            $result = $this->headingImportService->import(
                accountId: (int) $account->account_id,
                file: $file,
                contextFamily: $contextFamily,
                actorUserId: $actorUserId
            );
        } catch (RuntimeException $runtimeException) {
            if ($runtimeException->getMessage() === 'The file does not contain any usable heading rows.') {
                return response()->json([
                    'message' => 'No valid heading rows were found in the uploaded file.',
                    'errors' => [
                        'file' => ['The file does not contain any usable heading rows.'],
                    ],
                ], 422);
            }

            throw $runtimeException;
        }

        return response()->json([
            'batch_id' => $result['batch_id'],
            'headings_count' => $result['headings']->count(),
            'headings' => HeadingResource::collection($result['headings']),
        ], 201);
    }

    public function update(Request $request, string $accountCode, string $headingId)
    {
        $account = $this->resolveAccount($accountCode);
        if (!preg_match('/^\d+$/', $headingId)) {
            abort(404);
        }
        $heading = Heading::query()
            ->where('account_id', $account->account_id)
            ->where('heading_id', $headingId)
            ->with('families')
            ->firstOrFail();

        $validated = $request->validate([
            'heading_name' => ['sometimes', 'string', 'max:255'],
            'families' => ['sometimes', 'array'],
            'families.*' => ['nullable', 'string', 'max:255'],
            'grouping_family' => ['sometimes', 'nullable', 'string', 'max:255'],
            'supported_link' => ['sometimes', 'nullable', 'string', 'max:65535'],
            'workflow_stage' => ['sometimes', Rule::in(['imported', 'supported', 'assigned'])],
            'status' => ['sometimes', Rule::in(['existing', 'ranked', 'additional'])],
            'rank_points' => ['sometimes', 'nullable', 'string', 'max:64'],
            'heading_type' => ['sometimes', 'nullable', 'string', 'max:255'],
            'source_status' => ['sometimes', 'nullable', 'string', 'max:255'],
            'source_updated_at' => ['sometimes', 'nullable', 'string', 'max:255'],
            'definition' => ['sometimes', 'nullable', 'string'],
            'aliases' => ['sometimes', 'nullable', 'string'],
            'category' => ['sometimes', 'nullable', 'string', 'max:255'],
            'companies' => ['sometimes', 'nullable', 'string'],
        ]);

        if (isset($validated['heading_name'])) {
            $validated['heading_name'] = trim((string) $validated['heading_name']);
        }

        if (array_key_exists('families', $validated)) {
            $validated['families'] = $this->normalizeFamilies($validated['families']);
            $validated['families_json'] = $validated['families'];
        }

        unset($validated['families']);

        $heading->fill($validated);
        $heading->updated_by_user_id = $request->user()?->userId;
        $heading->save();

        if (array_key_exists('families_json', $validated)) {
            $this->syncHeadingFamilies($heading, $heading->families_json ?? []);
        }

        $heading->load('families');

        $this->activityLogService->log(
            accountId: (int) $account->account_id,
            action: 'heading.updated',
            details: "Updated heading {$heading->heading_id}",
            actorUserId: $request->user()?->userId,
            entityType: 'heading',
            entityId: $heading->heading_id
        );

        return response()->json([
            'heading' => (new HeadingResource($heading))->toArray($request),
        ]);
    }

    public function destroy(Request $request, string $accountCode, string $headingId)
    {
        $account = $this->resolveAccount($accountCode);
        if (!preg_match('/^\d+$/', $headingId)) {
            abort(404);
        }
        $heading = Heading::query()
            ->where('account_id', $account->account_id)
            ->where('heading_id', $headingId)
            ->firstOrFail();

        $headingIdValue = (int) $heading->heading_id;
        $heading->delete();

        $this->activityLogService->log(
            accountId: (int) $account->account_id,
            action: 'heading.deleted',
            details: "Deleted heading {$headingIdValue}",
            actorUserId: $request->user()?->userId,
            entityType: 'heading',
            entityId: $headingIdValue
        );

        return response()->noContent();
    }

    public function families(string $accountCode)
    {
        $account = $this->resolveAccount($accountCode);

        $families = HeadingFamily::query()
            ->whereIn('heading_id', function ($query) use ($account): void {
                $query->select('heading_id')
                    ->from('headings')
                    ->where('account_id', $account->account_id);
            })
            ->select('family_name')
            ->distinct()
            ->orderBy('family_name')
            ->pluck('family_name')
            ->values();

        return response()->json(['families' => $families]);
    }

    public function importBatches(string $accountCode)
    {
        $account = $this->resolveAccount($accountCode);

        $batches = ImportBatch::query()
            ->where('account_id', $account->account_id)
            ->with('importedBy:userId,username')
            ->withCount('items')
            ->orderByDesc('imported_at')
            ->get();

        return response()->json([
            'batches' => ImportBatchResource::collection($batches),
        ]);
    }

    /**
     * @param array<int, mixed> $families
     * @return array<int, string>
     */
    private function normalizeFamilies(array $families): array
    {
        $normalized = [];
        foreach ($families as $family) {
            $value = trim((string) $family);
            if ($value === '') {
                continue;
            }
            $normalized[] = $value;
        }

        return array_values(array_unique($normalized));
    }

    /**
     * @param array<int, string> $families
     */
    private function syncHeadingFamilies(Heading $heading, array $families): void
    {
        HeadingFamily::query()->where('heading_id', $heading->heading_id)->delete();

        foreach ($families as $family) {
            HeadingFamily::query()->create([
                'heading_id' => $heading->heading_id,
                'family_name' => $family,
            ]);
        }
    }
}
