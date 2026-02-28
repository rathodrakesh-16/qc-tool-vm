<?php

namespace App\Domain\QualityControl;

use App\Models\Pdm;
use Illuminate\Support\Facades\DB;

class ProductionReportService
{
    /**
     * @return array<string, mixed>
     */
    public function buildSummary(int $accountId): array
    {
        $headingsByStage = DB::table('headings')
            ->where('account_id', $accountId)
            ->select('workflow_stage', DB::raw('COUNT(*) as total'))
            ->groupBy('workflow_stage')
            ->get()
            ->mapWithKeys(fn ($row) => [(string) $row->workflow_stage => (int) $row->total])
            ->all();

        $headingsByStatus = DB::table('headings')
            ->where('account_id', $accountId)
            ->select('status', DB::raw('COUNT(*) as total'))
            ->groupBy('status')
            ->get()
            ->mapWithKeys(fn ($row) => [(string) $row->status => (int) $row->total])
            ->all();

        $pdmsByQcStatus = DB::table('pdms')
            ->where('account_id', $accountId)
            ->select('qc_status', DB::raw('COUNT(*) as total'))
            ->groupBy('qc_status')
            ->get()
            ->mapWithKeys(fn ($row) => [(string) $row->qc_status => (int) $row->total])
            ->all();

        $pdms = Pdm::query()
            ->where('account_id', $accountId)
            ->withCount('pdmHeadings')
            ->orderByDesc('created_at')
            ->limit(500)
            ->get(['pdm_id', 'word_count', 'qc_status', 'uploaded', 'created_at']);

        return [
            'total_headings' => (int) DB::table('headings')->where('account_id', $accountId)->count(),
            'headings_by_stage' => $headingsByStage,
            'headings_by_status' => $headingsByStatus,
            'total_pdms' => (int) DB::table('pdms')->where('account_id', $accountId)->count(),
            'pdms_by_qc_status' => $pdmsByQcStatus,
            'pdms_uploaded_count' => (int) DB::table('pdms')
                ->where('account_id', $accountId)
                ->where('uploaded', true)
                ->count(),
            'total_word_count' => (int) (DB::table('pdms')->where('account_id', $accountId)->sum('word_count') ?? 0),
            'pdms_list_summary' => $pdms->map(function (Pdm $pdm): array {
                return [
                    'pdmId' => (int) $pdm->pdm_id,
                    'wordCount' => (int) $pdm->word_count,
                    'qcStatus' => $pdm->qc_status,
                    'uploaded' => (bool) $pdm->uploaded,
                    'headingsCount' => (int) $pdm->pdm_headings_count,
                    'createdAt' => optional($pdm->created_at)->toISOString(),
                ];
            })->values()->all(),
        ];
    }
}
