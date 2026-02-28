<?php

namespace App\Domain\QualityControl;

use App\Models\PdmFeedbackHistory;
use App\Models\QcError;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class QcReportService
{
    /**
     * @return array<string, mixed>
     */
    public function buildSummary(int $accountId): array
    {
        $qcErrors = QcError::query()
            ->where('account_id', $accountId)
            ->with(['heading:heading_id,heading_name', 'reportedBy:userId,username'])
            ->orderByDesc('reported_at')
            ->limit(500)
            ->get();

        $errorCountByCategory = DB::table('qc_errors')
            ->where('account_id', $accountId)
            ->select('error_category', DB::raw('COUNT(*) as total'))
            ->groupBy('error_category')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row): array => [
                'errorCategory' => (string) $row->error_category,
                'count' => (int) $row->total,
            ])
            ->values()
            ->all();

        $rectificationSummary = DB::table('qc_errors')
            ->where('account_id', $accountId)
            ->select('rectification_status', DB::raw('COUNT(*) as total'))
            ->groupBy('rectification_status')
            ->get()
            ->mapWithKeys(fn ($row) => [(string) $row->rectification_status => (int) $row->total])
            ->all();

        $validationSummary = DB::table('qc_errors')
            ->where('account_id', $accountId)
            ->select('validation_status', DB::raw('COUNT(*) as total'))
            ->groupBy('validation_status')
            ->get()
            ->mapWithKeys(fn ($row) => [(string) $row->validation_status => (int) $row->total])
            ->all();

        $pdmIdsSubquery = DB::table('pdms')->where('account_id', $accountId)->select('pdm_id');

        $feedbackByUser = PdmFeedbackHistory::query()
            ->whereIn('pdm_id', $pdmIdsSubquery)
            ->select('feedback_user_id', DB::raw('COUNT(*) as total'))
            ->groupBy('feedback_user_id')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row): array => [
                'feedbackUserId' => $row->feedback_user_id,
                'count' => (int) $row->total,
            ])
            ->values()
            ->all();

        $latestFeedbackAtRaw = PdmFeedbackHistory::query()
            ->whereIn('pdm_id', $pdmIdsSubquery)
            ->max('feedback_at');

        return [
            'total_pdms_reviewed' => (int) DB::table('pdms')
                ->where('account_id', $accountId)
                ->whereIn('qc_status', ['checked', 'error'])
                ->count(),
            'error_count_by_category' => $errorCountByCategory,
            'rectification_summary' => $rectificationSummary,
            'validation_summary' => $validationSummary,
            'qc_errors_list' => $qcErrors,
            'feedback_summary' => [
                'totalSubmissions' => (int) PdmFeedbackHistory::query()
                    ->whereIn('pdm_id', $pdmIdsSubquery)
                    ->count(),
                'latestFeedbackAt' => $latestFeedbackAtRaw
                    ? CarbonImmutable::parse((string) $latestFeedbackAtRaw)->toISOString()
                    : null,
                'feedbackByUser' => $feedbackByUser,
            ],
        ];
    }
}
