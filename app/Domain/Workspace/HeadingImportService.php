<?php

namespace App\Domain\Workspace;

use App\Models\Heading;
use App\Models\HeadingFamily;
use App\Models\ImportBatch;
use App\Models\ImportBatchItem;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class HeadingImportService
{
    public function __construct(
        private readonly ActivityLogService $activityLogService,
        private readonly HeadingIdGenerator $headingIdGenerator
    ) {
    }

    /**
     * @return array{batch_id:int, headings:Collection<int, Heading>}
     */
    public function import(int $accountId, UploadedFile $file, ?string $contextFamily, ?string $actorUserId): array
    {
        $rows = $this->parseHeadingRows($file, $contextFamily);
        if ($rows === []) {
            throw new RuntimeException('The file does not contain any usable heading rows.');
        }

        $createdOrUpdated = [];
        $batchId = 0;

        DB::transaction(function () use (
            $accountId,
            $file,
            $contextFamily,
            $rows,
            $actorUserId,
            &$createdOrUpdated,
            &$batchId
        ): void {
            $batch = ImportBatch::query()->create([
                'account_id' => $accountId,
                'context_family' => $contextFamily,
                'file_name' => $file->getClientOriginalName(),
                'headings_count' => count($rows),
                'imported_by_user_id' => $actorUserId,
                'imported_at' => CarbonImmutable::now(),
            ]);

            foreach ($rows as $row) {
                $providedHeadingId = $row['heading_id'];
                if ($providedHeadingId !== null) {
                    $existsElsewhere = Heading::query()
                        ->where('heading_id', $providedHeadingId)
                        ->where('account_id', '!=', $accountId)
                        ->exists();
                    if ($existsElsewhere) {
                        $providedHeadingId = null;
                    }
                }

                $heading = null;
                if ($providedHeadingId !== null) {
                    $heading = Heading::query()
                        ->where('account_id', $accountId)
                        ->where('heading_id', $providedHeadingId)
                        ->first();
                }

                if ($heading === null) {
                    $heading = Heading::query()
                        ->where('account_id', $accountId)
                        ->whereRaw('LOWER(heading_name) = ?', [mb_strtolower($row['heading_name'])])
                        ->first();
                }

                $payload = [
                    'heading_name' => $row['heading_name'],
                    'families_json' => $row['families'],
                    'grouping_family' => $row['grouping_family'],
                    'supported_link' => $row['supported_link'],
                    'workflow_stage' => $row['workflow_stage'],
                    'status' => $row['status'],
                    'rank_points' => $row['rank_points'],
                    'heading_type' => $row['heading_type'],
                    'source_status' => $row['source_status'],
                    'source_updated_at' => $row['source_updated_at'],
                    'definition' => $row['definition'],
                    'aliases' => $row['aliases'],
                    'category' => $row['category'],
                    'companies' => $row['companies'],
                    'updated_by_user_id' => $actorUserId,
                ];

                if ($heading === null) {
                    $heading = Heading::query()->create([
                        ...$payload,
                        'heading_id' => $providedHeadingId ?? $this->headingIdGenerator->nextId(),
                        'account_id' => $accountId,
                        'created_by_user_id' => $actorUserId,
                    ]);
                } else {
                    $heading->fill($payload);
                    $heading->save();
                }

                $this->syncHeadingFamilies($heading, $row['families']);

                ImportBatchItem::query()->firstOrCreate([
                    'batch_id' => $batch->id,
                    'heading_id' => $heading->heading_id,
                ]);

                $createdOrUpdated[] = $heading->heading_id;
            }

            $this->activityLogService->log(
                accountId: $accountId,
                action: 'headings.imported',
                details: 'Imported '.count($rows).' heading(s) from '.$file->getClientOriginalName(),
                actorUserId: $actorUserId,
                entityType: 'import_batch',
                entityId: $batch->id
            );

            $batchId = (int) $batch->id;
        });

        $headings = Heading::query()
            ->whereIn('heading_id', array_values(array_unique($createdOrUpdated)))
            ->with('families')
            ->orderBy('heading_name')
            ->get();

        return [
            'batch_id' => $batchId,
            'headings' => $headings,
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function parseHeadingRows(UploadedFile $file, ?string $contextFamily): array
    {
        if (!class_exists('PhpOffice\\PhpSpreadsheet\\IOFactory')) {
            throw new RuntimeException(
                'Heading import requires phpoffice/phpspreadsheet.'
            );
        }

        $ioFactoryClass = 'PhpOffice\\PhpSpreadsheet\\IOFactory';
        $spreadsheet = $ioFactoryClass::load($file->getRealPath());
        $sheet = $spreadsheet->getActiveSheet();
        $rows = $sheet->toArray(null, true, true, false);

        if ($rows === []) {
            return [];
        }

        $firstRow = array_shift($rows);
        $headerMap = $this->buildHeaderMap($firstRow ?? []);
        if (!isset($headerMap['heading_name']) && !isset($headerMap['heading']) && !isset($headerMap['classification'])) {
            array_unshift($rows, $firstRow);
            $headerMap = [];
        }

        $parsed = [];
        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }

            $headingName = $this->readCell($row, $headerMap, ['heading_name', 'heading', 'classification', 'name'], 0);
            if ($headingName === null) {
                continue;
            }

            $families = $this->normalizeFamilies(
                $this->splitFamilies($this->readCell($row, $headerMap, ['family', 'families'], 3))
            );
            if ($contextFamily !== null && $contextFamily !== '' && !in_array($contextFamily, $families, true)) {
                $families[] = $contextFamily;
            }

            $parsed[] = [
                'heading_id' => $this->toNullableInt($this->readCell($row, $headerMap, ['heading_id', 'classification_id', 'id'], 1)),
                'heading_name' => $headingName,
                'families' => $families,
                'grouping_family' => $this->readCell($row, $headerMap, ['grouping_family', 'grouping'], 4),
                'supported_link' => $this->readCell($row, $headerMap, ['supported_link', 'site_link', 'url'], 6),
                'workflow_stage' => $this->normalizeEnum(
                    $this->readCell($row, $headerMap, ['workflow_stage'], null),
                    ['imported', 'supported', 'assigned'],
                    'imported'
                ),
                'status' => $this->normalizeEnum(
                    $this->readCell($row, $headerMap, ['status', 'heading_type'], 10),
                    ['existing', 'ranked', 'additional'],
                    'additional'
                ),
                'rank_points' => $this->readCell($row, $headerMap, ['rank_points'], 4),
                'heading_type' => $this->readCell($row, $headerMap, ['heading_type'], null),
                'source_status' => $this->readCell($row, $headerMap, ['source_status'], null),
                'source_updated_at' => $this->readCell($row, $headerMap, ['source_updated_at'], null),
                'definition' => $this->readCell($row, $headerMap, ['definition'], 2),
                'aliases' => $this->readCell($row, $headerMap, ['aliases'], null),
                'category' => $this->readCell($row, $headerMap, ['category'], 2),
                'companies' => $this->readCell($row, $headerMap, ['companies', 'company_type'], 5),
            ];
        }

        return $parsed;
    }

    /**
     * @param array<int, mixed> $row
     * @param array<string, int> $headerMap
     * @param array<int, string> $keys
     */
    private function readCell(array $row, array $headerMap, array $keys, ?int $fallbackIndex): ?string
    {
        foreach ($keys as $key) {
            if (array_key_exists($key, $headerMap)) {
                return $this->toNullableString($row[$headerMap[$key]] ?? null);
            }
        }

        if ($fallbackIndex !== null) {
            return $this->toNullableString($row[$fallbackIndex] ?? null);
        }

        return null;
    }

    /**
     * @param array<int, mixed> $headerRow
     * @return array<string, int>
     */
    private function buildHeaderMap(array $headerRow): array
    {
        $headerMap = [];

        foreach ($headerRow as $index => $value) {
            $key = $this->normalizeHeader((string) $value);
            if ($key !== '') {
                $headerMap[$key] = (int) $index;
            }
        }

        return $headerMap;
    }

    private function normalizeHeader(string $value): string
    {
        $normalized = strtolower(trim($value));
        $normalized = str_replace(['-', ' '], '_', $normalized);

        return preg_replace('/[^a-z0-9_]/', '', $normalized) ?? '';
    }

    private function toNullableString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $string = trim((string) $value);
        return $string === '' ? null : $string;
    }

    private function toNullableInt(?string $value): ?int
    {
        if ($value === null || !preg_match('/^\d+$/', $value)) {
            return null;
        }

        return (int) $value;
    }

    /**
     * @param array<int, string> $allowed
     */
    private function normalizeEnum(?string $value, array $allowed, string $default): string
    {
        if ($value === null) {
            return $default;
        }

        foreach ($allowed as $allowedValue) {
            if (strcasecmp($value, $allowedValue) === 0) {
                return $allowedValue;
            }
        }

        return $default;
    }

    /**
     * @return array<int, string>
     */
    private function splitFamilies(?string $value): array
    {
        if ($value === null || trim($value) === '') {
            return [];
        }

        return preg_split('/\s*,\s*/', $value, -1, PREG_SPLIT_NO_EMPTY) ?: [];
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
