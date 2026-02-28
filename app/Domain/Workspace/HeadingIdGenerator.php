<?php

namespace App\Domain\Workspace;

use App\Models\Heading;

class HeadingIdGenerator
{
    public function nextId(): int
    {
        $max = (int) (Heading::query()->max('heading_id') ?? 0);
        return $max + 1;
    }
}

