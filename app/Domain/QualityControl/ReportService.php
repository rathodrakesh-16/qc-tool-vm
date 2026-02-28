<?php

namespace App\Domain\QualityControl;

class ReportService
{
    use QualityControlHelpers;

    public function __construct(
        private readonly ValidationService $validationService
    ) {
    }

    /**
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function generate(array $input): array
    {
        $classificationDetails = $this->arrayOrEmpty($input['classificationDetails'] ?? []);

        $pdmGroupsRaw = [];
        $unsupportedHeadings = [];
        $unprocessedHeadings = [];
        $noPdmHeadings = [];
        $deletedHeadings = [];

        $addedHeadingsSet = [];
        $existingHeadingsSet = [];
        $addedLinksSet = [];
        $existingLinksSet = [];

        foreach ($classificationDetails as $row) {
            if (!is_array($row)) {
                continue;
            }

            $classificationId = $this->toString($row[0] ?? '');
            $classification = $this->toString($row[1] ?? '');
            $family = $this->toString($row[3] ?? '');
            $companyType = $this->toString($row[5] ?? '');
            $siteLink = $this->toString($row[6] ?? '');
            $quality = $this->toString($row[7] ?? '');
            $profileDescription = $this->toString($row[8] ?? '');
            $pdmText = $this->toString($row[9] ?? '');
            $headingType = $this->toString($row[10] ?? '');
            $headingTypeLower = strtolower(trim($headingType));

            if (str_contains($headingTypeLower, 'deleted')) {
                $deletedHeadings[] = [
                    'headingId' => $classificationId,
                    'headingName' => $classification,
                    'assignedUrl' => $siteLink,
                    'family' => $family,
                    'hqs' => $quality,
                ];
                continue;
            }

            if (!$this->isAddedOrExisting($headingTypeLower)) {
                continue;
            }

            $normalizedQuality = strtolower(trim($quality));
            $isUnsupported = $normalizedQuality === 'unsupported';
            $isUnprocessed = $normalizedQuality === 'unprocessed';

            if ($isUnsupported || $isUnprocessed) {
                $validationFields = [];
                if (!$this->isNoUrl($siteLink)) {
                    $validationFields[] = 'URL';
                }
                if (trim($profileDescription) !== '') {
                    $validationFields[] = 'PDM Number';
                }
                if (trim($companyType) !== '') {
                    $validationFields[] = 'Company Type';
                }

                $item = [
                    'headingId' => $classificationId,
                    'headingName' => $classification,
                    'family' => $family,
                    'error' => $validationFields !== [] ? 'Has: '.implode(', ', $validationFields) : '',
                ];

                $this->trackHeadingTypeSet(
                    $headingTypeLower,
                    $classification,
                    $addedHeadingsSet,
                    $existingHeadingsSet
                );

                if ($isUnsupported) {
                    $unsupportedHeadings[] = $item;
                } else {
                    $unprocessedHeadings[] = $item;
                }
            } elseif (trim($profileDescription) === '' || !$this->isNumericProfileDescription($profileDescription)) {
                $this->trackHeadingTypeSet(
                    $headingTypeLower,
                    $classification,
                    $addedHeadingsSet,
                    $existingHeadingsSet
                );

                $noPdmHeadings[] = [
                    'headingId' => $classificationId,
                    'headingName' => $classification,
                    'family' => $family,
                ];
            } else {
                $isAdded = str_contains($headingTypeLower, 'added');
                if ($isAdded) {
                    $addedHeadingsSet[$classification] = true;
                    if ($siteLink !== '') {
                        $addedLinksSet[$siteLink] = true;
                    }
                } else {
                    $existingHeadingsSet[$classification] = true;
                    if ($siteLink !== '') {
                        $existingLinksSet[$siteLink] = true;
                    }
                }
            }

            if (trim($profileDescription) !== '' && $this->isNumericProfileDescription($profileDescription)) {
                $pdmKey = $profileDescription;

                if (!isset($pdmGroupsRaw[$pdmKey])) {
                    $pdmGroupsRaw[$pdmKey] = [
                        'headings' => [],
                        'assignedUrls' => [],
                        'families' => [],
                        'pdmTexts' => [],
                    ];
                }

                $pdmGroupsRaw[$pdmKey]['headings'][] = [
                    'name' => $classification,
                    'type' => $headingType,
                    'url' => $siteLink,
                    'family' => $family,
                    'companyType' => $companyType,
                    'quality' => $quality,
                ];
                $pdmGroupsRaw[$pdmKey]['assignedUrls'][] = $siteLink !== '' ? $siteLink : 'No URL assigned';
                $pdmGroupsRaw[$pdmKey]['families'][] = $family;

                if ($pdmText !== '') {
                    $pdmGroupsRaw[$pdmKey]['pdmTexts'][$pdmText] = true;
                }
            }
        }

        $pdmGroups = $this->finalizePdmGroups($pdmGroupsRaw);
        $validationResults = $this->validationService->validate($pdmGroups);

        return [
            'pdmGroups' => $pdmGroups,
            'validationResults' => $validationResults,
            'summary' => [
                'totalGroupedPDMs' => count($pdmGroups),
                'totalExistingHeadings' => count($existingHeadingsSet),
                'uniqueExistingLinks' => count($existingLinksSet),
                'totalAddedHeadings' => count($addedHeadingsSet),
                'uniqueAddedLinks' => count($addedLinksSet),
                'totalUnsupportedHeadings' => count($unsupportedHeadings),
                'totalDeletedHeadings' => count($deletedHeadings),
            ],
            'unsupportedHeadings' => array_values($unsupportedHeadings),
            'unprocessedHeadings' => array_values($unprocessedHeadings),
            'noPdmHeadings' => array_values($noPdmHeadings),
            'deletedHeadings' => array_values($deletedHeadings),
        ];
    }

    /**
     * @param array<string, array<string, mixed>> $pdmGroupsRaw
     * @return array<string, array<string, mixed>>
     */
    private function finalizePdmGroups(array $pdmGroupsRaw): array
    {
        $groups = [];

        foreach ($pdmGroupsRaw as $pdmNum => $groupData) {
            $pdmTextCandidates = array_keys($groupData['pdmTexts'] ?? []);
            $pdmText = $pdmTextCandidates[0] ?? '';
            $pdmTextStatus = $this->resolvePdmTextStatus($pdmText);
            $headings = array_values($groupData['headings'] ?? []);
            $families = array_values($groupData['families'] ?? []);

            $groups[$pdmNum] = [
                'headings' => $headings,
                'assignedUrls' => array_values($groupData['assignedUrls'] ?? []),
                'families' => $families,
                'pdmText' => $pdmTextStatus === 'ok' ? $pdmText : '',
                'pdmTextStatus' => $pdmTextStatus,
                'wordCount' => $pdmTextStatus === 'ok' ? $this->wordCount($pdmText) : 0,
                'displayCommonFamily' => $this->resolveMajorityFamilies($families),
                'displayCompanyType' => $this->resolveDisplayCompanyType($headings),
                'displayQuality' => $this->resolveDisplayQuality($headings),
            ];
        }

        return $groups;
    }

    /**
     * @param array<string, bool> $addedHeadingsSet
     * @param array<string, bool> $existingHeadingsSet
     */
    private function trackHeadingTypeSet(
        string $headingTypeLower,
        string $classification,
        array &$addedHeadingsSet,
        array &$existingHeadingsSet
    ): void {
        if ($classification === '') {
            return;
        }

        if (str_contains($headingTypeLower, 'added')) {
            $addedHeadingsSet[$classification] = true;
        } else {
            $existingHeadingsSet[$classification] = true;
        }
    }

    private function resolvePdmTextStatus(string $pdmText): string
    {
        $trimmed = trim($pdmText);
        if ($trimmed === '') {
            return 'pdm_text_missing_in_library';
        }

        if ($trimmed === 'This Heading does not have PDM') {
            return 'no_pdm_for_heading';
        }

        if ($trimmed === 'This PDM number does not have PDM text in Library') {
            return 'pdm_text_missing_in_library';
        }

        return 'ok';
    }

    private function wordCount(string $text): int
    {
        $trimmed = trim($text);
        if ($trimmed === '') {
            return 0;
        }

        return count(preg_split('/\s+/', $trimmed) ?: []);
    }

    private function isAddedOrExisting(string $headingTypeLower): bool
    {
        return str_contains($headingTypeLower, 'added') || str_contains($headingTypeLower, 'existing');
    }

    private function isNumericProfileDescription(string $value): bool
    {
        $trimmed = trim($value);

        return $trimmed !== '' && is_numeric($trimmed);
    }

    /**
     * @param array<int, mixed> $families
     */
    private function resolveMajorityFamilies(array $families): string
    {
        if ($families === []) {
            return 'No common family';
        }

        $familySets = [];
        foreach ($families as $family) {
            $parts = array_map('trim', explode(',', $this->toString($family)));
            $parts = array_values(array_filter($parts, static fn (string $part): bool => $part !== ''));
            $familySets[] = array_unique($parts);
        }

        $frequency = [];
        foreach ($familySets as $set) {
            foreach ($set as $family) {
                $frequency[$family] = ($frequency[$family] ?? 0) + 1;
            }
        }

        $threshold = count($families) / 2;
        $majorities = [];
        foreach ($frequency as $family => $count) {
            if ($count > $threshold) {
                $majorities[] = $family;
            }
        }

        return $majorities !== [] ? implode(', ', $majorities) : 'No common family';
    }

    /**
     * @param array<int, mixed> $headings
     */
    private function resolveDisplayCompanyType(array $headings): string
    {
        $types = [];
        foreach ($headings as $heading) {
            if (!is_array($heading)) {
                continue;
            }
            $types[] = $this->toString($heading['companyType'] ?? '');
        }

        $majority = $this->resolveMajorityValue($types);
        if ($majority !== '') {
            return $majority;
        }

        if ($types !== [] && trim($types[0]) !== '') {
            return $types[0];
        }

        foreach ($types as $type) {
            if (trim($type) !== '') {
                return $type;
            }
        }

        return 'Not specified';
    }

    /**
     * @param array<int, mixed> $headings
     */
    private function resolveDisplayQuality(array $headings): string
    {
        $qualities = [];
        foreach ($headings as $heading) {
            if (!is_array($heading)) {
                continue;
            }
            $qualities[] = $this->toString($heading['quality'] ?? '');
        }

        $majority = $this->resolveMajorityValue($qualities);
        return $majority !== '' ? $majority : 'Not specified';
    }

    /**
     * @param array<int, string> $values
     */
    private function resolveMajorityValue(array $values): string
    {
        $normalizedCounts = [];
        $displayMap = [];
        $valid = [];

        foreach ($values as $value) {
            $trimmed = trim($value);
            if ($trimmed === '') {
                continue;
            }

            $valid[] = $trimmed;
            $key = strtolower($trimmed);
            $normalizedCounts[$key] = ($normalizedCounts[$key] ?? 0) + 1;
            $displayMap[$key] = $trimmed;
        }

        if ($valid === []) {
            return '';
        }

        $threshold = count($valid) / 2;
        foreach ($normalizedCounts as $key => $count) {
            if ($count > $threshold) {
                return $displayMap[$key] ?? '';
            }
        }

        return '';
    }
}
