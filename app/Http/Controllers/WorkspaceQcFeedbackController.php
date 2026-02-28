<?php

namespace App\Http\Controllers;

use App\Domain\Workspace\QcFeedbackService;
use App\Http\Controllers\Concerns\ResolvesWorkspaceAccount;
use App\Http\Resources\PdmFeedbackHistoryResource;
use App\Http\Resources\PdmQcFeedbackResource;
use App\Models\Pdm;
use App\Models\PdmFeedbackHistory;
use App\Models\PdmQcFeedback;
use Illuminate\Http\Request;

class WorkspaceQcFeedbackController extends Controller
{
    use ResolvesWorkspaceAccount;

    public function __construct(
        private readonly QcFeedbackService $qcFeedbackService
    ) {
    }

    public function show(Request $request, string $accountCode, string $pdmId)
    {
        $account = $this->resolveAccount($accountCode);
        if (!preg_match('/^\d+$/', $pdmId)) {
            abort(404);
        }
        $pdm = $this->resolvePdm($account->account_id, (int) $pdmId);

        $feedback = PdmQcFeedback::query()
            ->where('pdm_id', $pdm->pdm_id)
            ->with(['errors', 'feedbackUser:userId,username'])
            ->first();

        return response()->json([
            'feedback' => $feedback ? (new PdmQcFeedbackResource($feedback))->toArray($request) : null,
        ]);
    }

    public function store(Request $request, string $accountCode, string $pdmId)
    {
        $account = $this->resolveAccount($accountCode);
        if (!preg_match('/^\d+$/', $pdmId)) {
            abort(404);
        }

        $validated = $request->validate([
            'updated_description' => ['nullable', 'string', 'max:65535'],
            'comment' => ['nullable', 'string', 'max:65535'],
            'error_categories' => ['sometimes', 'array'],
            'error_categories.*' => ['nullable', 'string', 'max:255'],
        ]);

        $feedback = $this->qcFeedbackService->upsert(
            accountId: (int) $account->account_id,
            pdmId: (int) $pdmId,
            payload: $validated,
            actorUserId: $request->user()?->userId
        );

        return response()->json([
            'feedback' => (new PdmQcFeedbackResource($feedback))->toArray($request),
        ], 201);
    }

    public function history(Request $request, string $accountCode, string $pdmId)
    {
        $account = $this->resolveAccount($accountCode);
        if (!preg_match('/^\d+$/', $pdmId)) {
            abort(404);
        }
        $pdm = $this->resolvePdm($account->account_id, (int) $pdmId);

        $history = PdmFeedbackHistory::query()
            ->where('pdm_id', $pdm->pdm_id)
            ->with('feedbackUser:userId,username')
            ->orderByDesc('feedback_at')
            ->get();

        return response()->json([
            'history' => PdmFeedbackHistoryResource::collection($history),
        ]);
    }

    private function resolvePdm(int $accountId, int $pdmId): Pdm
    {
        return Pdm::query()
            ->where('account_id', $accountId)
            ->where('pdm_id', $pdmId)
            ->firstOrFail();
    }
}
