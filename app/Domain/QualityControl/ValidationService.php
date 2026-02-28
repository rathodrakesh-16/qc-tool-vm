<?php

namespace App\Domain\QualityControl;

class ValidationService
{
    use QualityControlHelpers;
    /**
     * @param array<string, mixed> $pdmGroups
     * @return array<int, array{pdmNum:string, errors:array<int, string>}>
     */
    public function validate(array $pdmGroups): array
    {
        $validationResults = [];
        $seenPdmTexts = [];
        $referenceDomain = $this->determineReferenceDomain($pdmGroups);

        foreach ($pdmGroups as $pdmNum => $pdmData) {
            $group = is_array($pdmData) ? $pdmData : [];
            $pdmNumString = (string) $pdmNum;
            $headings = $this->toHeadingList($group['headings'] ?? []);
            $pdmText = $this->toString($group['pdmText'] ?? '');
            $pdmTextStatus = strtolower(trim($this->toString($group['pdmTextStatus'] ?? 'ok')));
            $errors = [];

            if ($pdmTextStatus === 'pdm_text_missing_in_library') {
                $errors[] = 'PDM text not found in library.';
                $validationResults[] = [
                    'pdmNum' => $pdmNumString,
                    'errors' => $errors,
                ];
                continue;
            }

            $links = array_map(
                fn (array $heading): string => $this->isNoUrl($heading['url'] ?? null)
                    ? 'No URL assigned'
                    : $this->toString($heading['url'] ?? ''),
                $headings
            );
            $assignedLinks = array_values(array_filter(
                $links,
                static fn (string $link): bool => $link !== 'No URL assigned'
            ));

            $errors = array_merge($errors, $this->validateLinksConsistency($headings, $links, $assignedLinks));
            $errors = array_merge($errors, $this->validateFamilyConsistency($headings));
            $errors = array_merge($errors, $this->validateUrlAndDomain($headings, $links, $referenceDomain));
            $errors = array_merge($errors, $this->validatePdmTextFormatting($pdmText));
            $errors = array_merge($errors, $this->validateDuplicatePdmText($pdmText, $pdmTextStatus, $seenPdmTexts));
            $errors = array_merge($errors, $this->validateForbiddenBrands($pdmText));
            $errors = array_merge($errors, $this->validateLargeNumbers($pdmText));
            $errors = array_merge($errors, $this->validateMaxHeadings($headings));
            $errors = array_merge($errors, $this->validateCompanyTypeConsistency($headings));
            $errors = array_merge($errors, $this->validateQualityAllowList($headings));
            $errors = array_merge($errors, $this->validateQualityConsistency($headings));
            $errors = array_merge($errors, $this->validateSpecialQualityIntegrity($headings, $pdmNumString));

            if ($errors !== []) {
                $validationResults[] = [
                    'pdmNum' => $pdmNumString,
                    'errors' => array_values($errors),
                ];
            }
        }

        return $validationResults;
    }

    /**
     * @param array<string, mixed> $pdmGroups
     */
    private function determineReferenceDomain(array $pdmGroups): ?string
    {
        $domainMetrics = [];
        $pdmIndex = 0;

        foreach ($pdmGroups as $pdmData) {
            $group = is_array($pdmData) ? $pdmData : [];
            $headings = $this->toHeadingList($group['headings'] ?? []);
            $domainsInSection = [];

            foreach ($headings as $heading) {
                $url = $this->toString($heading['url'] ?? '');
                if ($this->isNoUrl($url)) {
                    continue;
                }

                $domain = $this->extractDomain($url);
                if ($domain !== null) {
                    $domainsInSection[$domain] = true;
                }
            }

            foreach (array_keys($domainsInSection) as $domain) {
                if (!isset($domainMetrics[$domain])) {
                    $domainMetrics[$domain] = [
                        'count' => 0,
                        'firstIndex' => $pdmIndex,
                    ];
                }

                $domainMetrics[$domain]['count']++;
            }

            $pdmIndex++;
        }

        if ($domainMetrics === []) {
            return null;
        }

        uasort($domainMetrics, static function (array $a, array $b): int {
            if ($a['count'] !== $b['count']) {
                return $b['count'] <=> $a['count'];
            }

            return $a['firstIndex'] <=> $b['firstIndex'];
        });

        /** @var string $referenceDomain */
        $referenceDomain = array_key_first($domainMetrics);
        return $referenceDomain;
    }

    /**
     * @param array<int, array<string, string>> $headings
     * @param array<int, string> $links
     * @param array<int, string> $assignedLinks
     * @return array<int, string>
     */
    private function validateLinksConsistency(array $headings, array $links, array $assignedLinks): array
    {
        if (count($assignedLinks) <= 1) {
            return [];
        }

        $firstLink = $assignedLinks[0];
        $mismatched = [];

        foreach ($headings as $idx => $heading) {
            $url = $links[$idx] ?? 'No URL assigned';
            if ($url === 'No URL assigned' || $url === $firstLink) {
                continue;
            }

            $name = $this->toString($heading['name'] ?? '');
            $mismatched[] = "{$name} ({$url})";
        }

        if ($mismatched === []) {
            return [];
        }

        return ['Headings have different links: '.implode('; ', $mismatched)];
    }

    /**
     * @param array<int, array<string, string>> $headings
     * @return array<int, string>
     */
    private function validateFamilyConsistency(array $headings): array
    {
        $families = array_map(
            fn (array $heading): string => $this->toString($heading['family'] ?? ''),
            $headings
        );

        $familySets = array_map(fn (string $family): array => $this->splitFamilies($family), $families);
        $frequency = [];

        foreach ($familySets as $familySet) {
            foreach ($familySet as $family) {
                $frequency[$family] = ($frequency[$family] ?? 0) + 1;
            }
        }

        $totalHeadings = count($headings);
        $majorityThreshold = $totalHeadings / 2;
        $majorityFamilies = [];

        foreach ($frequency as $family => $count) {
            if ($count > $majorityThreshold) {
                $majorityFamilies[] = $family;
            }
        }

        if ($majorityFamilies !== []) {
            $headingsWithoutMajority = [];

            foreach ($headings as $idx => $heading) {
                $headingFamilies = $familySets[$idx] ?? [];
                $hasMajority = count(array_intersect($majorityFamilies, $headingFamilies)) > 0;
                if ($hasMajority) {
                    continue;
                }

                $name = $this->toString($heading['name'] ?? '');
                $familyDisplay = $families[$idx] !== '' ? $families[$idx] : 'No family';
                $headingsWithoutMajority[] = "{$name} ({$familyDisplay})";
            }

            if ($headingsWithoutMajority === []) {
                return [];
            }

            return ['No common family for '.implode('; ', $headingsWithoutMajority)];
        }

        $headingDescriptions = [];
        foreach ($headings as $idx => $heading) {
            $name = $this->toString($heading['name'] ?? '');
            $familyDisplay = $families[$idx] !== '' ? $families[$idx] : 'No family';
            $headingDescriptions[] = "{$name} ({$familyDisplay})";
        }

        return ['No common family found among '.implode('; ', $headingDescriptions)];
    }

    /**
     * @param array<int, array<string, string>> $headings
     * @param array<int, string> $links
     * @return array<int, string>
     */
    private function validateUrlAndDomain(array $headings, array $links, ?string $referenceDomain): array
    {
        $errors = [];

        foreach ($headings as $index => $heading) {
            $headingName = $this->toString($heading['name'] ?? '');
            $quality = strtolower(trim($this->toString($heading['quality'] ?? '')));
            $url = $links[$index] ?? 'No URL assigned';

            $isExemptQuality = in_array($quality, ['unsupported', 'supported by profile content'], true);
            if ($url === 'No URL assigned') {
                if (!$isExemptQuality) {
                    $errors[] = "{$headingName}: No URL assigned.";
                }
                continue;
            }

            $urlValidation = $this->validateUrl($url);
            if (!$urlValidation['isValid']) {
                $errors[] = "{$headingName}: {$urlValidation['output']}";
            }

            $domain = $this->extractDomain($url);
            if ($referenceDomain !== null && $domain !== null && $domain !== $referenceDomain) {
                $errors[] = "{$headingName}: Domain mismatch. Expected domain is {$referenceDomain}, found {$domain}.";
            }
        }

        return $errors;
    }

    /**
     * @return array<int, string>
     */
    private function validatePdmTextFormatting(string $pdmText): array
    {
        $errors = [];

        if (preg_match('/\s{2,}/', $pdmText) === 1) {
            $errors[] = 'PDM Text contains extra spaces.';
        }

        if ($pdmText !== trim($pdmText)) {
            $errors[] = 'PDM Text has leading/trailing spaces.';
        }

        return $errors;
    }

    /**
     * @param array<string, bool> $seenPdmTexts
     * @return array<int, string>
     */
    private function validateDuplicatePdmText(string $pdmText, string $pdmTextStatus, array &$seenPdmTexts): array
    {
        if ($pdmTextStatus !== 'ok' || trim($pdmText) === '') {
            return [];
        }

        if (isset($seenPdmTexts[$pdmText])) {
            return ['Duplicate PDM found!'];
        }

        $seenPdmTexts[$pdmText] = true;
        return [];
    }

    /**
     * @return array<int, string>
     */
    private function validateForbiddenBrands(string $pdmText): array
    {
        $brands = config('qualitycontrol.validation.forbidden_brands', []);
        if (!is_array($brands)) {
            return [];
        }

        $found = [];

        foreach ($brands as $brand) {
            if (!is_string($brand) || trim($brand) === '') {
                continue;
            }

            $quotedBrand = preg_quote($brand, '/');
            if (preg_match("/\\b{$quotedBrand}(?:\\x{00AE})?\\b/iu", $pdmText) === 1) {
                $found[] = $brand;
            }
        }

        if ($found === []) {
            return [];
        }

        return ['PDM Text contains forbidden brand names: '.implode(', ', $found).'.'];
    }

    /**
     * @return array<int, string>
     */
    private function validateLargeNumbers(string $pdmText): array
    {
        $matchesFound = preg_match_all('/\b(?<![\d.])(\d{4,})(?![\d.])\b/', $pdmText, $matches);
        if ($matchesFound === false || $matchesFound === 0) {
            return [];
        }

        $numbers = array_values(array_unique($matches[1]));
        if ($numbers === []) {
            return [];
        }

        $plural = count($numbers) > 1 ? 's' : '';
        return ['PDM Text contains large number'.$plural.' without commas: '.implode(', ', $numbers).'.'];
    }

    /**
     * @param array<int, array<string, string>> $headings
     * @return array<int, string>
     */
    private function validateQualityAllowList(array $headings): array
    {
        $allowed = config('qualitycontrol.validation.quality_values', []);
        if (!is_array($allowed) || $allowed === []) {
            return [];
        }

        $normalizedAllowed = [];
        foreach ($allowed as $quality) {
            if (!is_string($quality) || trim($quality) === '') {
                continue;
            }

            $normalizedAllowed[strtolower(trim($quality))] = true;
        }

        $forbidden = config('qualitycontrol.validation.forbidden_quality_values', []);
        $normalizedForbidden = [];
        if (is_array($forbidden)) {
            foreach ($forbidden as $quality) {
                if (!is_string($quality) || trim($quality) === '') {
                    continue;
                }

                $normalizedForbidden[strtolower(trim($quality))] = trim($quality);
            }
        }

        $errors = [];
        foreach ($headings as $heading) {
            $quality = trim($this->toString($heading['quality'] ?? ''));
            if ($quality === '') {
                continue;
            }

            $normalizedQuality = strtolower($quality);
            $name = $this->toString($heading['name'] ?? '');

            if (isset($normalizedForbidden[$normalizedQuality])) {
                $errors[] = 'Heading "'.$name.'": Type of Proof "'.$quality.'" is not allowed.';
                continue;
            }

            if ($normalizedAllowed !== [] && !isset($normalizedAllowed[$normalizedQuality])) {
                $errors[] = 'Heading "'.$name.'" has invalid Type of Proof value: "'.$quality.'".';
            }
        }

        return $errors;
    }

    /**
     * @param array<int, array<string, string>> $headings
     * @return array<int, string>
     */
    private function validateMaxHeadings(array $headings): array
    {
        $max = (int) config('qualitycontrol.validation.max_headings', 8);
        if (count($headings) <= $max) {
            return [];
        }

        return ['Too many headings ('.count($headings).'). Max allowed: '.$max.'.'];
    }

    /**
     * @param array<int, array<string, string>> $headings
     * @return array<int, string>
     */
    private function validateCompanyTypeConsistency(array $headings): array
    {
        if (count($headings) < 2) {
            return [];
        }

        $normalizeType = static function (string $type): string {
            $trimmed = trim($type);
            if ($trimmed === '' || $trimmed === 'Not specified') {
                return '';
            }

            $parts = array_map(
                static fn (string $part): string => strtolower(trim($part)),
                explode(',', $trimmed)
            );
            $parts = array_values(array_filter($parts, static fn (string $part): bool => $part !== ''));
            sort($parts);

            return implode(', ', $parts);
        };

        $companyTypes = array_map(
            static fn (array $heading): array => [
                'original' => (string) ($heading['companyType'] ?? ''),
                'normalized' => $normalizeType((string) ($heading['companyType'] ?? '')),
            ],
            $headings
        );

        $reference = $companyTypes[0];
        $errors = [];

        if ($reference['normalized'] === '') {
            $errors[] = 'Company Type mismatch.'."\n".
                'Heading 1 "'.$this->toString($headings[0]['name'] ?? '').'" is missing Company Type (used as reference).';
        }

        for ($i = 1; $i < count($headings); $i++) {
            $current = $companyTypes[$i];
            if ($current['normalized'] === '') {
                $errors[] = 'Company Type mismatch.'."\n".
                    'Heading '.($i + 1).' "'.$this->toString($headings[$i]['name'] ?? '').'" is missing Company Type.';
                continue;
            }

            if ($reference['normalized'] !== '' && $current['normalized'] !== $reference['normalized']) {
                $errors[] = 'Company Type mismatch.'."\n".
                    'Reference (Heading 1): "'.$reference['original'].'".'."\n".
                    'Mismatch: '.$this->toString($headings[$i]['name'] ?? '').' ('.$current['original'].')';
            }
        }

        return $errors;
    }

    /**
     * @param array<int, array<string, string>> $headings
     * @return array<int, string>
     */
    private function validateQualityConsistency(array $headings): array
    {
        $qualities = array_map(
            fn (array $heading): string => $this->toString($heading['quality'] ?? '') !== ''
                ? $this->toString($heading['quality'] ?? '')
                : 'Not specified',
            $headings
        );

        $containsNonDefault = count(array_filter(
            $qualities,
            static fn (string $quality): bool => $quality !== 'Not specified'
        )) > 0;

        if (!$containsNonDefault) {
            return [];
        }

        $frequency = [];
        foreach ($qualities as $quality) {
            $normalized = strtolower(trim($quality));
            $frequency[$normalized] = ($frequency[$normalized] ?? 0) + 1;
        }

        $totalWithQuality = count(array_filter(
            $headings,
            static fn (array $heading): bool => trim((string) ($heading['quality'] ?? '')) !== ''
        ));
        $threshold = $totalWithQuality / 2;

        $majorityQuality = null;
        foreach ($frequency as $quality => $count) {
            if ($count > $threshold) {
                $majorityQuality = $quality;
                break;
            }
        }

        if ($majorityQuality !== null) {
            $mismatched = [];
            foreach ($headings as $heading) {
                $quality = trim($this->toString($heading['quality'] ?? ''));
                if ($quality === '') {
                    continue;
                }

                if (strtolower($quality) !== $majorityQuality) {
                    $mismatched[] = $this->toString($heading['name'] ?? '').' ('.$quality.')';
                }
            }

            if ($mismatched !== []) {
                $displayMajority = $majorityQuality;
                foreach ($qualities as $quality) {
                    if (strtolower(trim($quality)) === $majorityQuality) {
                        $displayMajority = $quality;
                        break;
                    }
                }

                return [
                    'Type of Proof mismatch.'."\n".
                    'Majority is "'.$displayMajority.'".'."\n".
                    'Mismatches: '.implode("\n", $mismatched),
                ];
            }

            return [];
        }

        if ($totalWithQuality > 1) {
            $allDetails = [];
            foreach ($headings as $heading) {
                $quality = trim($this->toString($heading['quality'] ?? ''));
                if ($quality === '') {
                    continue;
                }

                $allDetails[] = $this->toString($heading['name'] ?? '').' ('.$quality.')';
            }

            if ($allDetails !== []) {
                return ['Type of Proof mismatch.'."\n".implode(";\n", $allDetails)];
            }
        }

        return [];
    }

    /**
     * @param array<int, array<string, string>> $headings
     * @return array<int, string>
     */
    private function validateSpecialQualityIntegrity(array $headings, string $pdmNum): array
    {
        $errors = [];

        foreach ($headings as $heading) {
            $quality = strtolower(trim($this->toString($heading['quality'] ?? '')));
            $name = $this->toString($heading['name'] ?? '');
            $url = $this->toString($heading['url'] ?? '');
            $companyType = trim($this->toString($heading['companyType'] ?? ''));

            if ($quality === 'unsupported') {
                $fields = [];

                if (!$this->isNoUrl($url)) {
                    $fields[] = 'URL';
                }
                if (trim($pdmNum) !== '') {
                    $fields[] = 'PDM Number';
                }
                if ($companyType !== '') {
                    $fields[] = 'Company Type';
                }

                if ($fields !== []) {
                    $errors[] = 'Heading "'.$name.'" is "Unsupported" but has: '.implode(', ', $fields).'.';
                }
            } elseif ($quality === 'supported by profile content') {
                if (!$this->isNoUrl($url)) {
                    $errors[] = 'Heading "'.$name.'" is "Supported by Profile Content" but has: URL.';
                }
            }
        }

        return $errors;
    }

    /**
     * @param array<int, mixed> $headings
     * @return array<int, array<string, string>>
     */
    private function toHeadingList(array $headings): array
    {
        $normalized = [];

        foreach ($headings as $heading) {
            if (!is_array($heading)) {
                continue;
            }

            $normalized[] = [
                'name' => $this->toString($heading['name'] ?? ''),
                'type' => $this->toString($heading['type'] ?? ''),
                'url' => $this->toString($heading['url'] ?? ''),
                'family' => $this->toString($heading['family'] ?? ''),
                'companyType' => $this->toString($heading['companyType'] ?? ''),
                'quality' => $this->toString($heading['quality'] ?? ''),
            ];
        }

        return $normalized;
    }

    /**
     * @return array<int, string>
     */
    private function splitFamilies(string $family): array
    {
        $parts = array_map('trim', explode(',', $family));
        $parts = array_values(array_filter($parts, static fn (string $value): bool => $value !== ''));

        return array_values(array_unique($parts));
    }

    /**
     * @return array{output:string, isValid:bool}
     */
    private function validateUrl(string $url): array
    {
        if (trim($url) === '') {
            return ['output' => '', 'isValid' => false];
        }

        $forbiddenWords = config('qualitycontrol.validation.forbidden_url_words', []);
        if (is_array($forbiddenWords)) {
            foreach ($forbiddenWords as $word => $message) {
                if (!is_string($word) || !is_string($message) || $word === '') {
                    continue;
                }

                if (str_contains(strtolower($url), strtolower($word))) {
                    return ['output' => $message, 'isValid' => false];
                }
            }
        }

        $urlRegex = '/^(https?:\/\/)?([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/[a-zA-Z0-9\-._~:\/?#[\]@!$&\'()*+,;=]*)?$/i';
        if (preg_match($urlRegex, $url) !== 1) {
            return ['output' => 'Incorrect URL structure', 'isValid' => false];
        }

        if (!str_starts_with($url, 'http://') && !str_starts_with($url, 'https://')) {
            return ['output' => 'Missing http:// or https://', 'isValid' => false];
        }

        if (str_starts_with($url, 'http://')) {
            return ['output' => 'HTTP link found (less secure)', 'isValid' => false];
        }

        return ['output' => 'Valid URL!', 'isValid' => true];
    }

    private function extractDomain(string $url): ?string
    {
        $host = parse_url($url, PHP_URL_HOST);
        if (!is_string($host) || trim($host) === '') {
            return null;
        }

        $host = strtolower(trim($host));
        return preg_replace('/^www\./', '', $host) ?: null;
    }

    /**
     * @param mixed $url
     */
    private function isNoUrl($url): bool
    {
        $urlString = trim($this->toString($url));
        return $urlString === '' || strtolower($urlString) === 'no url assigned';
    }
}
