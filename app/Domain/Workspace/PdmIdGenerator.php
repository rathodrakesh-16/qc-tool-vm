<?php

namespace App\Domain\Workspace;

use App\Models\Pdm;
use Carbon\CarbonImmutable;
use RuntimeException;

class PdmIdGenerator
{
    public function generate(): int
    {
        $now = CarbonImmutable::now();
        $yy = $now->format('y');
        $ddd = str_pad((string) $now->dayOfYear, 3, '0', STR_PAD_LEFT);
        $prefix = $yy.$ddd;
        $rangeStart = (int) ($prefix.'000');
        $rangeEnd = (int) ($prefix.'999');

        $latestToday = (int) (Pdm::query()
            ->whereBetween('pdm_id', [$rangeStart, $rangeEnd])
            ->max('pdm_id') ?? 0);

        $next = $latestToday > 0 ? $latestToday + 1 : $rangeStart;

        if ($next > $rangeEnd) {
            throw new RuntimeException('Daily PDM id limit reached. Try again tomorrow.');
        }

        return $next;
    }
}

