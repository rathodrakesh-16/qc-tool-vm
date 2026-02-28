<?php

namespace App\Http\Controllers;

use App\Domain\QualityControl\ProductionReportService;
use App\Domain\QualityControl\QcReportService;
use App\Http\Controllers\Concerns\ResolvesWorkspaceAccount;
use App\Http\Resources\QcErrorResource;
use Illuminate\Http\Request;
use RuntimeException;

class WorkspaceReportController extends Controller
{
    use ResolvesWorkspaceAccount;

    public function __construct(
        private readonly ProductionReportService $productionReportService,
        private readonly QcReportService $qcReportService
    ) {
    }

    public function production(string $accountCode)
    {
        $account = $this->resolveAccount($accountCode);

        return response()->json(
            $this->productionReportService->buildSummary((int) $account->account_id)
        );
    }

    public function qc(Request $request, string $accountCode)
    {
        $account = $this->resolveAccount($accountCode);
        $summary = $this->qcReportService->buildSummary((int) $account->account_id);

        return response()->json([
            ...$summary,
            'qc_errors_list' => QcErrorResource::collection($summary['qc_errors_list']),
        ]);
    }

    public function exportQc(string $accountCode)
    {
        $account = $this->resolveAccount($accountCode);

        if (!class_exists('PhpOffice\\PhpSpreadsheet\\Spreadsheet') || !class_exists('PhpOffice\\PhpSpreadsheet\\Writer\\Xlsx')) {
            throw new RuntimeException('QC export requires phpoffice/phpspreadsheet and ext-zip.');
        }

        $production = $this->productionReportService->buildSummary((int) $account->account_id);
        $qc = $this->qcReportService->buildSummary((int) $account->account_id);

        $spreadsheetClass = 'PhpOffice\\PhpSpreadsheet\\Spreadsheet';
        $spreadsheet = new $spreadsheetClass();

        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('QC Summary');
        $rows = [
            ['Account', (string) $account->account_name],
            ['Account ID', (string) $account->account_id],
            ['Total PDMs', (string) $production['total_pdms']],
            ['PDMs Reviewed', (string) $qc['total_pdms_reviewed']],
            ['PDMs Uploaded', (string) $production['pdms_uploaded_count']],
            ['Total Word Count', (string) $production['total_word_count']],
            ['', ''],
            ['QC Errors by Category', 'Count'],
        ];

        foreach ($qc['error_count_by_category'] as $row) {
            $rows[] = [(string) $row['errorCategory'], (string) $row['count']];
        }

        $sheet->fromArray($rows, null, 'A1');
        foreach (range('A', 'B') as $column) {
            $sheet->getColumnDimension($column)->setAutoSize(true);
        }

        $directory = storage_path('app/workspace-exports');
        if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
            throw new RuntimeException('Failed to create workspace export directory.');
        }

        $filename = 'qc_report_'.$account->account_id.'_'.date('Ymd_His').'.xlsx';
        $path = $directory.DIRECTORY_SEPARATOR.$filename;

        $writerClass = 'PhpOffice\\PhpSpreadsheet\\Writer\\Xlsx';
        $writer = new $writerClass($spreadsheet);
        $writer->save($path);

        return response()->download($path, $filename)->deleteFileAfterSend(true);
    }

}
