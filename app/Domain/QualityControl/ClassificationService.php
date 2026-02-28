<?php

namespace App\Domain\QualityControl;

class ClassificationService
{
    use QualityControlHelpers;

    private const PDM_TEXT_NO_PDM = 'This Heading does not have PDM';
    private const PDM_TEXT_NOT_IN_LIBRARY = 'This PDM number does not have PDM text in Library';

    /**
     * @param array<string, mixed> $input
     * @return array{classificationDetails: array<int, array<int, string>>}
     */
    public function generate(array $input): array
    {
        $afterproofRows = $this->arrayOrEmpty($input['dataTableData'] ?? []);
        $pdmRows = $this->arrayOrEmpty($input['dataTablePDMData'] ?? []);
        $beforeproofRows = $this->arrayOrEmpty($input['pulldataBackupTableData'] ?? []);

        $classificationDetails = $this->mapAfterproofRows($afterproofRows);
        $pdmMap = $this->buildPdmMap($pdmRows);

        $this->syncPdmText($classificationDetails, $pdmMap);

        if ($beforeproofRows !== []) {
            $this->updateHeadingType($classificationDetails, $beforeproofRows);
            $deletedRows = $this->buildDeletedRows($afterproofRows, $beforeproofRows, $pdmMap);
            if ($deletedRows !== []) {
                $classificationDetails = array_merge($classificationDetails, $deletedRows);
            }
        } else {
            $this->markAllAsAdded($classificationDetails);
        }

        return [
            'classificationDetails' => $classificationDetails,
        ];
    }

    /**
     * @param array<int, mixed> $rows
     * @return array<int, array<int, string>>
     */
    private function mapAfterproofRows(array $rows): array
    {
        $classificationDetails = [];

        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }

            $classificationId = $this->toString($row[1] ?? '');
            $definition = $this->toString($row[2] ?? '');
            $profileDescription = $this->toString($row[7] ?? '');
            $resolvedProfileDescription = $profileDescription !== ''
                ? $profileDescription
                : ($definition !== '' ? $this->extractNumber($definition) : '');

            $classificationDetails[] = [
                $classificationId !== '' ? $this->formatHeadingId($classificationId) : '',
                $this->toString($row[0] ?? ''),
                $this->toString($row[3] ?? ''),
                $this->toString($row[4] ?? ''),
                $this->toString($row[5] ?? ''),
                $this->toString($row[6] ?? ''),
                $this->toString($row[8] ?? ''),
                $this->toString($row[9] ?? ''),
                $resolvedProfileDescription,
                '',
                '',
            ];
        }

        return $classificationDetails;
    }

    /**
     * @param array<int, mixed> $rows
     * @return array<string, string>
     */
    private function buildPdmMap(array $rows): array
    {
        $map = [];

        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }

            $pdmId = strtolower(trim($this->toString($row[0] ?? '')));
            if ($pdmId === '') {
                continue;
            }

            $map[$pdmId] = $this->toString($row[2] ?? '');
        }

        return $map;
    }

    /**
     * @param array<int, array<int, string>> $classificationDetails
     * @param array<string, string> $pdmMap
     */
    private function syncPdmText(array &$classificationDetails, array $pdmMap): void
    {
        foreach ($classificationDetails as &$row) {
            $profileDescriptionValue = strtolower(trim($row[8] ?? ''));

            if ($profileDescriptionValue === '' || !is_numeric($profileDescriptionValue)) {
                $row[9] = self::PDM_TEXT_NO_PDM;
                continue;
            }

            if (array_key_exists($profileDescriptionValue, $pdmMap)) {
                $row[9] = $pdmMap[$profileDescriptionValue];
                continue;
            }

            $row[9] = self::PDM_TEXT_NOT_IN_LIBRARY;
        }
    }

    /**
     * @param array<int, array<int, string>> $classificationDetails
     * @param array<int, mixed> $beforeproofRows
     */
    private function updateHeadingType(array &$classificationDetails, array $beforeproofRows): void
    {
        $beforeproofNames = [];
        foreach ($beforeproofRows as $row) {
            if (!is_array($row)) {
                continue;
            }

            $name = strtolower(trim($this->toString($row[0] ?? '')));
            if ($name !== '') {
                $beforeproofNames[$name] = true;
            }
        }

        foreach ($classificationDetails as &$row) {
            $classification = strtolower(trim($row[1] ?? ''));

            if ($classification === '') {
                $row[10] = '';
                continue;
            }

            $row[10] = isset($beforeproofNames[$classification]) ? 'Existing' : 'Added';
        }
    }

    /**
     * @param array<int, array<int, string>> $classificationDetails
     */
    private function markAllAsAdded(array &$classificationDetails): void
    {
        foreach ($classificationDetails as &$row) {
            $row[10] = 'Added';
        }
    }

    /**
     * @param array<int, mixed> $afterproofRows
     * @param array<int, mixed> $beforeproofRows
     * @param array<string, string> $pdmMap
     * @return array<int, array<int, string>>
     */
    private function buildDeletedRows(array $afterproofRows, array $beforeproofRows, array $pdmMap): array
    {
        $currentHeadings = [];
        foreach ($afterproofRows as $row) {
            if (!is_array($row)) {
                continue;
            }

            $classification = strtolower(trim($this->toString($row[0] ?? '')));
            if ($classification !== '') {
                $currentHeadings[$classification] = true;
            }
        }

        $deletedRows = [];

        foreach ($beforeproofRows as $row) {
            if (!is_array($row)) {
                continue;
            }

            $classification = trim($this->toString($row[0] ?? ''));
            if ($classification === '') {
                continue;
            }

            $normalized = strtolower($classification);
            if (isset($currentHeadings[$normalized])) {
                continue;
            }

            $profileDescription = $this->toString($row[7] ?? '');
            $pdmText = $this->resolvePdmTextForDeletedHeading($profileDescription, $pdmMap);

            $deletedRows[] = [
                $this->formatHeadingId(trim($this->toString($row[1] ?? ''))),
                $classification,
                $this->toString($row[3] ?? ''),
                $this->toString($row[4] ?? ''),
                $this->toString($row[5] ?? ''),
                $this->toString($row[6] ?? ''),
                $this->toString($row[8] ?? ''),
                $this->toString($row[9] ?? ''),
                $profileDescription,
                $pdmText,
                'Deleted',
            ];
        }

        return $deletedRows;
    }

    /**
     * @param array<string, string> $pdmMap
     */
    private function resolvePdmTextForDeletedHeading(string $profileDescription, array $pdmMap): string
    {
        if ($profileDescription === '') {
            return self::PDM_TEXT_NO_PDM;
        }

        $pdmId = strtolower(trim($profileDescription));
        if (array_key_exists($pdmId, $pdmMap)) {
            return $pdmMap[$pdmId];
        }

        return self::PDM_TEXT_NOT_IN_LIBRARY;
    }

    private function formatHeadingId(string $headingId): string
    {
        $cleanNumber = str_replace('ID:', '', $headingId);
        $cleanNumber = preg_replace('/[^0-9]/', '', $cleanNumber) ?? '';

        return str_pad($cleanNumber, 8, '0', STR_PAD_LEFT);
    }

    private function extractNumber(string $value): string
    {
        if (preg_match('/\d+/', $value, $matches) === 1) {
            return $matches[0];
        }

        return '';
    }

}
