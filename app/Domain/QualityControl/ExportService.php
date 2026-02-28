<?php

namespace App\Domain\QualityControl;

use RuntimeException;

class ExportService
{
    use QualityControlHelpers;

    public function __construct(
        private readonly ReportService $reportService
    ) {
    }

    /**
     * @param array<string, mixed> $input
     * @return array{path:string, filename:string}
     */
    public function generate(array $input): array
    {
        if (!class_exists('PhpOffice\\PhpSpreadsheet\\Spreadsheet') || !class_exists('PhpOffice\\PhpSpreadsheet\\Writer\\Xlsx')) {
            throw new RuntimeException(
                'QC export requires phpoffice/phpspreadsheet and PHP extensions ext-gd/ext-zip.'
            );
        }

        $classificationDetails = $this->arrayOrEmpty($input['classificationDetails'] ?? []);
        $accountDetails = $this->arrayOrEmpty($input['accountDetails'] ?? []);
        $companyProfile = $this->toString($input['companyProfile'] ?? '');
        $requestedFilename = $this->toString($input['filename'] ?? 'QC_Report');

        $report = $this->reportService->generate([
            'classificationDetails' => $classificationDetails,
            'accountDetails' => $accountDetails,
            'companyProfile' => $companyProfile,
        ]);

        $spreadsheetClass = 'PhpOffice\\PhpSpreadsheet\\Spreadsheet';
        /** @var object $spreadsheet */
        $spreadsheet = new $spreadsheetClass();

        $this->buildAccountSummarySheet($spreadsheet, $report, $accountDetails, $companyProfile);
        $this->buildSimpleTableSheet($spreadsheet, 'Unsupported Headings', $report['unsupportedHeadings'] ?? []);
        $this->buildSimpleTableSheet($spreadsheet, 'Unprocessed Headings', $report['unprocessedHeadings'] ?? []);
        $this->buildSimpleTableSheet($spreadsheet, 'Headings with No PDM Number', $report['noPdmHeadings'] ?? []);
        $this->buildSimpleTableSheet($spreadsheet, 'Deleted Headings', $report['deletedHeadings'] ?? []);
        $this->buildPdmDetailsSheet($spreadsheet, $report['pdmGroups'] ?? [], $accountDetails);
        $this->buildPrimaryValidationSheet($spreadsheet, $report['validationResults'] ?? []);
        $this->buildClassificationDetailsSheet($spreadsheet, $classificationDetails);

        $filename = $this->buildExportFilename($requestedFilename);
        $directory = storage_path('app/qc-exports');
        if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
            throw new RuntimeException('Failed to create export directory.');
        }

        $path = $directory.DIRECTORY_SEPARATOR.$filename;
        $writerClass = 'PhpOffice\\PhpSpreadsheet\\Writer\\Xlsx';
        $writer = new $writerClass($spreadsheet);
        $writer->save($path);

        return [
            'path' => $path,
            'filename' => $filename,
        ];
    }

    /**
     * @param object $spreadsheet
     * @param array<string, mixed> $report
     * @param array<string, mixed> $accountDetails
     */
    private function buildAccountSummarySheet(object $spreadsheet, array $report, array $accountDetails, string $companyProfile): void
    {
        $rows = [
            ['Summary', ''],
            ['Account Name', $this->toString($accountDetails['accountName'] ?? 'Not provided')],
            ['Account ID', $this->toString($accountDetails['accountId'] ?? 'Not provided')],
            ['Editor Name', $this->toString($accountDetails['editorName'] ?? 'Not provided')],
            ['QC Name', $this->toString($accountDetails['qcName'] ?? 'Not provided')],
            ['', ''],
            ['Total Grouped PDMs', (string) ($report['summary']['totalGroupedPDMs'] ?? 0)],
            ['Total Existing Headings', (string) ($report['summary']['totalExistingHeadings'] ?? 0)],
            ['Unique Links for Existing Headings', (string) ($report['summary']['uniqueExistingLinks'] ?? 0)],
            ['Total Added Headings', (string) ($report['summary']['totalAddedHeadings'] ?? 0)],
            ['Unique Links for Added Headings', (string) ($report['summary']['uniqueAddedLinks'] ?? 0)],
            ['Total unsupported heading', (string) ($report['summary']['totalUnsupportedHeadings'] ?? 0)],
            ['Total Deleted Headings', (string) ($report['summary']['totalDeletedHeadings'] ?? 0)],
            ['', ''],
            ['Company Profile Description', $companyProfile !== '' ? $companyProfile : 'Not provided'],
        ];

        $this->writeSheet($spreadsheet, 'Account Summary', $rows);
    }

    /**
     * @param object $spreadsheet
     * @param array<int, mixed> $items
     */
    private function buildSimpleTableSheet(object $spreadsheet, string $sheetName, array $items): void
    {
        if ($items === []) {
            return;
        }

        $headerMap = [
            'Unsupported Headings' => ['Heading ID', 'Heading Name', 'Family', 'Error'],
            'Unprocessed Headings' => ['Heading ID', 'Heading Name', 'Family', 'Error'],
            'Headings with No PDM Number' => ['Heading ID', 'Heading Name', 'Family'],
            'Deleted Headings' => ['Heading ID', 'Heading Name', 'Assigned URL', 'Family', 'HQS'],
        ];

        $rows = [$headerMap[$sheetName] ?? ['Value']];

        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }

            if ($sheetName === 'Unsupported Headings' || $sheetName === 'Unprocessed Headings') {
                $rows[] = [
                    $this->toString($item['headingId'] ?? ''),
                    $this->toString($item['headingName'] ?? ''),
                    $this->toString($item['family'] ?? ''),
                    $this->toString($item['error'] ?? 'OK'),
                ];
                continue;
            }

            if ($sheetName === 'Headings with No PDM Number') {
                $rows[] = [
                    $this->toString($item['headingId'] ?? ''),
                    $this->toString($item['headingName'] ?? ''),
                    $this->toString($item['family'] ?? ''),
                ];
                continue;
            }

            $rows[] = [
                $this->toString($item['headingId'] ?? ''),
                $this->toString($item['headingName'] ?? ''),
                $this->toString($item['assignedUrl'] ?? ''),
                $this->toString($item['family'] ?? ''),
                $this->toString($item['hqs'] ?? ''),
            ];
        }

        if (count($rows) > 1) {
            $this->writeSheet($spreadsheet, $sheetName, $rows);
        }
    }

    /**
     * @param object $spreadsheet
     * @param array<string, mixed> $pdmGroups
     * @param array<string, mixed> $accountDetails
     */
    private function buildPdmDetailsSheet(object $spreadsheet, array $pdmGroups, array $accountDetails): void
    {
        $rows = [[
            'SDMS Data',
            '',
            'Production Errors',
            'QC Comment',
            'QC Updates',
            'Editor Name',
            'QC Name',
            'Editor Status',
            'QC Status',
        ]];

        $editorName = $this->toString($accountDetails['editorName'] ?? '');
        $qcName = $this->toString($accountDetails['qcName'] ?? '');

        foreach ($pdmGroups as $pdmNum => $groupData) {
            if (!is_array($groupData)) {
                continue;
            }

            $rows[] = [(string) $pdmNum, '', '', '', '', '', '', '', ''];
            $headings = $this->arrayOrEmpty($groupData['headings'] ?? []);
            foreach ($headings as $heading) {
                if (!is_array($heading)) {
                    continue;
                }

                $label = trim($this->toString($heading['type'] ?? '')) !== ''
                    ? $this->toString($heading['type'] ?? '').' Heading'
                    : 'Heading';
                $rows[] = [$label, $this->toString($heading['name'] ?? ''), '', '', '', '', '', '', ''];
            }

            $assignedUrls = $this->arrayOrEmpty($groupData['assignedUrls'] ?? []);
            $rows[] = ['Assigned URL', $this->toString($assignedUrls[0] ?? 'No URL assigned'), '', '', '', '', '', '', ''];
            $rows[] = ['Common Family', $this->toString($groupData['displayCommonFamily'] ?? 'No common family'), '', '', '', '', '', '', ''];
            $rows[] = ['Company Type', $this->toString($groupData['displayCompanyType'] ?? 'Not specified'), '', '', '', '', '', '', ''];
            $rows[] = ['Type of Proof', $this->toString($groupData['displayQuality'] ?? 'Not specified'), '', '', '', '', '', '', ''];
            $rows[] = ['PDM Description', $this->toString($groupData['pdmText'] ?? ''), '', '', '', $editorName, $qcName, '', ''];
            $rows[] = ['', '', '', '', '', '', '', '', ''];
            $rows[] = ['', '', '', '', '', '', '', '', ''];
        }

        if (count($rows) === 1) {
            $rows[] = ['PDM Details', 'No data available', '', '', '', '', '', '', ''];
        }

        $this->writeSheet($spreadsheet, 'PDM Details', $rows);
    }

    /**
     * @param object $spreadsheet
     * @param array<int, mixed> $validationResults
     */
    private function buildPrimaryValidationSheet(object $spreadsheet, array $validationResults): void
    {
        $rows = [['Primary Validation', '']];

        if ($validationResults === []) {
            $rows[] = ['All PDM sections passed validation.', ''];
            $this->writeSheet($spreadsheet, 'Primary Validation', $rows);
            return;
        }

        foreach ($validationResults as $result) {
            if (!is_array($result)) {
                continue;
            }

            $pdmNum = $this->toString($result['pdmNum'] ?? '');
            $rows[] = [$pdmNum, ''];

            $errors = $this->arrayOrEmpty($result['errors'] ?? []);
            foreach ($errors as $error) {
                $rows[] = ['', $this->toString($error)];
            }

            $rows[] = ['', ''];
        }

        $this->writeSheet($spreadsheet, 'Primary Validation', $rows);
    }

    /**
     * @param object $spreadsheet
     * @param array<int, mixed> $classificationDetails
     */
    private function buildClassificationDetailsSheet(object $spreadsheet, array $classificationDetails): void
    {
        $header = config('qualitycontrol.classification_columns', []);
        if (!is_array($header) || $header === []) {
            $header = [
                'classificationId',
                'classification',
                'category',
                'family',
                'rankPoints',
                'companyType',
                'siteLink',
                'quality',
                'profileDescription',
                'pdmText',
                'headingType',
            ];
        }

        $rows = [array_map(
            fn ($value): string => $this->toString($value),
            $header
        )];

        foreach ($classificationDetails as $row) {
            if (!is_array($row)) {
                continue;
            }

            $rows[] = array_map(
                fn ($value): string => $this->toString($value),
                $row
            );
        }

        $this->writeSheet($spreadsheet, 'Classification Details', $rows);
    }

    /**
     * @param object $spreadsheet
     * @param array<int, array<int, string>> $rows
     */
    private function writeSheet(object $spreadsheet, string $title, array $rows): void
    {
        $cleanTitle = $this->sanitizeSheetTitle($title);
        $sheetCount = $spreadsheet->getSheetCount();
        $sheet = $sheetCount === 1 && $spreadsheet->getSheet(0)->getHighestRow() === 1
            ? $spreadsheet->getSheet(0)
            : $spreadsheet->createSheet();

        $sheet->setTitle($cleanTitle);
        $sheet->fromArray($rows, null, 'A1');

        $highestColumn = $sheet->getHighestColumn();
        $highestRow = $sheet->getHighestRow();

        $fontSize = (int) config('qualitycontrol.export.font_size', 11);
        $fontFamily = (string) config('qualitycontrol.export.font_family', 'Calibri');
        $headerColor = (string) config('qualitycontrol.export.header_bg_color', 'D3D3D3');

        $sheet->getStyle("A1:{$highestColumn}{$highestRow}")
            ->getFont()
            ->setName($fontFamily)
            ->setSize($fontSize);

        $sheet->getStyle("A1:{$highestColumn}1")->applyFromArray([
            'font' => ['bold' => true],
            'fill' => [
                'fillType' => 'solid',
                'startColor' => ['rgb' => $headerColor],
            ],
        ]);

        foreach (range('A', $highestColumn) as $column) {
            $sheet->getColumnDimension($column)->setAutoSize(true);
        }
    }

    private function buildExportFilename(string $requestedFilename): string
    {
        $base = preg_replace('/[^A-Za-z0-9 _.-]/', '', $requestedFilename) ?? '';
        $base = trim($base);
        if ($base === '') {
            $base = 'QC_Report';
        }

        $date = date('M-d-Y');
        return $base.'_'.$date.'.xlsx';
    }

    private function sanitizeSheetTitle(string $title): string
    {
        $clean = preg_replace('/[\\\\\\/\\?\\*\\:\\[\\]]/', '', $title) ?? 'Sheet';
        $clean = trim($clean);
        if ($clean === '') {
            $clean = 'Sheet';
        }

        return mb_substr($clean, 0, 31);
    }

}
