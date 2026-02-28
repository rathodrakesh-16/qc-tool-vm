<?php

namespace App\Http\Controllers;

use App\Domain\Workspace\ExistingHeadingService;
use App\Http\Controllers\Concerns\ResolvesWorkspaceAccount;
use App\Http\Resources\ExistingHeadingSnapshotItemResource;
use App\Http\Resources\ExistingHeadingSnapshotResource;
use App\Models\ExistingHeadingSnapshot;
use App\Models\ExistingHeadingSnapshotItem;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use RuntimeException;

class WorkspaceExistingHeadingController extends Controller
{
    use ResolvesWorkspaceAccount;

    public function __construct(
        private readonly ExistingHeadingService $existingHeadingService
    ) {
    }

    public function upload(Request $request, string $accountCode)
    {
        $account = $this->resolveAccount($accountCode);
        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv'],
        ]);

        /** @var UploadedFile $file */
        $file = $validated['file'];
        try {
            $result = $this->existingHeadingService->upload(
                accountId: (int) $account->account_id,
                file: $file,
                actorUserId: $request->user()?->userId
            );
        } catch (RuntimeException $runtimeException) {
            if ($runtimeException->getMessage() === 'Upload did not contain any valid heading rows.') {
                return response()->json([
                    'message' => 'No valid rows found in beforeproof upload.',
                    'errors' => ['file' => ['Upload did not contain any valid heading rows.']],
                ], 422);
            }

            throw $runtimeException;
        }

        return response()->json([
            'snapshot_id' => (int) $result['snapshot']->id,
            'items_count' => $result['items']->count(),
            'items' => ExistingHeadingSnapshotItemResource::collection($result['items']),
        ], 201);
    }

    public function active(Request $request, string $accountCode)
    {
        $account = $this->resolveAccount($accountCode);

        $snapshot = ExistingHeadingSnapshot::query()
            ->where('account_id', $account->account_id)
            ->where('is_active', true)
            ->with('uploadedBy:userId,username')
            ->orderByDesc('uploaded_at')
            ->first();

        if ($snapshot === null) {
            return response()->json([
                'snapshot' => null,
                'items' => [],
            ]);
        }

        $items = ExistingHeadingSnapshotItem::query()
            ->where('snapshot_id', $snapshot->id)
            ->orderBy('id')
            ->get();

        return response()->json([
            'snapshot' => (new ExistingHeadingSnapshotResource($snapshot))->toArray($request),
            'items' => ExistingHeadingSnapshotItemResource::collection($items),
        ]);
    }

    public function snapshots(string $accountCode)
    {
        $account = $this->resolveAccount($accountCode);

        $snapshots = ExistingHeadingSnapshot::query()
            ->where('account_id', $account->account_id)
            ->with('uploadedBy:userId,username')
            ->withCount('items')
            ->orderByDesc('uploaded_at')
            ->get();

        return response()->json([
            'snapshots' => ExistingHeadingSnapshotResource::collection($snapshots),
        ]);
    }

}
