<?php

namespace App\Domain\Workspace;

use App\Models\ExistingHeadingSnapshot;
use App\Models\ExistingHeadingSnapshotItem;
use App\Models\Heading;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ExistingHeadingService
{
    public function __construct(
        private readonly ActivityLogService $activityLogService
    ) {
    }

    /**
     * @return array{snapshot:ExistingHeadingSnapshot, items:Collection<int, ExistingHeadingSnapshotItem>}
     */
    public function upload(int $accountId, UploadedFile $file, ?string $actorUserId): array
    {
        $rows = $this->parseRows($file);
        if ($rows === []) {
            throw new RuntimeException('Upload did not contain any valid heading rows.');
        }

        $snapshot = DB::transaction(function () use ($accountId, $file, $rows, $actorUserId): ExistingHeadingSnapshot {
            ExistingHeadingSnapshot::query()
                ->where('account_id', $accountId)
                ->where('is_active', true)
                ->update(['is_active' => false]);

            $snapshot = ExistingHeadingSnapshot::query()->create([
                'account_id' => $accountId,
                'file_name' => $file->getClientOriginalName(),
                'uploaded_by_user_id' => $actorUserId,
                'uploaded_at' => now(),
                'is_active' => true,
            ]);

            $matchedHeadingIds = [];

            foreach ($rows as $row) {
                $headingId = $row['heading_id'];
                $headingName = $row['heading_name'];

                $heading = null;
                if ($headingId !== null) {
                    $heading = Heading::query()
                        ->where('account_id', $accountId)
                        ->where('heading_id', $headingId)
                        ->first();
                }

                if ($heading === null) {
                    $heading = Heading::query()
                        ->where('account_id', $accountId)
                        ->whereRaw('LOWER(heading_name) = ?', [mb_strtolower($headingName)])
                        ->first();
                }

                ExistingHeadingSnapshotItem::query()->create([
                    'snapshot_id' => $snapshot->id,
                    'heading_id' => $heading?->heading_id ?? $headingId,
                    'heading_name' => $headingName,
                    'rank_points' => $row['rank_points'],
                    'definition' => $row['definition'],
                    'category' => $row['category'],
                    'family' => $row['family'],
                    'company_type' => $row['company_type'],
                    'profile_description' => $row['profile_description'],
                    'site_link' => $row['site_link'],
                    'quality' => $row['quality'],
                    'source_last_updated' => $row['source_last_updated'],
                ]);

                if ($heading !== null) {
                    $matchedHeadingIds[] = (int) $heading->heading_id;
                    $heading->status = ($row['rank_points'] !== null && trim($row['rank_points']) !== '')
                        ? 'ranked'
                        : 'existing';
                    $heading->updated_by_user_id = $actorUserId;
                    $heading->save();
                }
            }

            $matchedHeadingIds = array_values(array_unique($matchedHeadingIds));

            Heading::query()
                ->where('account_id', $accountId)
                ->when($matchedHeadingIds !== [], function ($query) use ($matchedHeadingIds): void {
                    $query->whereNotIn('heading_id', $matchedHeadingIds);
                })
                ->update([
                    'status' => 'additional',
                    'updated_by_user_id' => $actorUserId,
                ]);

            $this->activityLogService->log(
                accountId: $accountId,
                action: 'existing_headings.uploaded',
                details: "Uploaded beforeproof snapshot {$snapshot->id}",
                actorUserId: $actorUserId,
                entityType: 'existing_heading_snapshot',
                entityId: $snapshot->id
            );

            return $snapshot;
        });

        $items = ExistingHeadingSnapshotItem::query()
            ->where('snapshot_id', $snapshot->id)
            ->orderBy('id')
            ->get();

        return [
            'snapshot' => $snapshot,
            'items' => $items,
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function parseRows(UploadedFile $file): array
    {
        if (!class_exists('PhpOffice\\PhpSpreadsheet\\IOFactory')) {
            throw new RuntimeException('Beforeproof upload requires phpoffice/phpspreadsheet.');
        }

        $ioFactoryClass = 'PhpOffice\\PhpSpreadsheet\\IOFactory';
        $spreadsheet = $ioFactoryClass::load($file->getRealPath());
        $sheet = $spreadsheet->getActiveSheet();
        $rows = $sheet->toArray(null, true, true, false);

        if ($rows === []) {
            return [];
        }

        $firstRow = array_shift($rows);
        $headers = $this->buildHeaderMap($firstRow ?? []);
        if (!isset($headers['heading_name']) && !isset($headers['heading']) && !isset($headers['classification'])) {
            array_unshift($rows, $firstRow);
            $headers = [];
        }

        $parsed = [];
        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }

            $headingName = $this->readCell($row, $headers, ['heading_name', 'heading', 'classification', 'name'], 0);
            if ($headingName === null) {
                continue;
            }

            $parsed[] = [
                'heading_id' => $this->toNullableInt($this->readCell($row, $headers, ['heading_id', 'classification_id', 'id'], 1)),
                'heading_name' => $headingName,
                'rank_points' => $this->readCell($row, $headers, ['rank_points'], 4),
                'definition' => $this->readCell($row, $headers, ['definition'], 2),
                'category' => $this->readCell($row, $headers, ['category'], 3),
                'family' => $this->readCell($row, $headers, ['family'], 5),
                'company_type' => $this->readCell($row, $headers, ['company_type'], 6),
                'profile_description' => $this->readCell($row, $headers, ['profile_description'], 7),
                'site_link' => $this->readCell($row, $headers, ['site_link', 'url'], 8),
                'quality' => $this->readCell($row, $headers, ['quality'], 9),
                'source_last_updated' => $this->readCell($row, $headers, ['source_last_updated'], 10),
            ];
        }

        return $parsed;
    }

    /**
     * @param array<int, mixed> $row
     * @param array<string, int> $headers
     * @param array<int, string> $keys
     */
    private function readCell(array $row, array $headers, array $keys, ?int $fallback): ?string
    {
        foreach ($keys as $key) {
            if (array_key_exists($key, $headers)) {
                return $this->toNullableString($row[$headers[$key]] ?? null);
            }
        }

        return $fallback !== null ? $this->toNullableString($row[$fallback] ?? null) : null;
    }

    /**
     * @param array<int, mixed> $headerRow
     * @return array<string, int>
     */
    private function buildHeaderMap(array $headerRow): array
    {
        $map = [];
        foreach ($headerRow as $index => $value) {
            $header = strtolower(trim((string) $value));
            $header = str_replace([' ', '-'], '_', $header);
            $header = preg_replace('/[^a-z0-9_]/', '', $header) ?? '';
            if ($header !== '') {
                $map[$header] = (int) $index;
            }
        }

        return $map;
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
}
