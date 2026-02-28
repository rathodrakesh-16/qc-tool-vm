<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExistingHeadingSnapshotItem extends Model
{
    use HasFactory;

    protected $table = 'existing_heading_snapshot_items';
    public $timestamps = false;

    protected $fillable = [
        'snapshot_id',
        'heading_id',
        'heading_name',
        'rank_points',
        'definition',
        'category',
        'family',
        'company_type',
        'profile_description',
        'site_link',
        'quality',
        'source_last_updated',
    ];

    protected $casts = [
        'snapshot_id' => 'integer',
        'heading_id' => 'integer',
    ];

    public function snapshot(): BelongsTo
    {
        return $this->belongsTo(ExistingHeadingSnapshot::class, 'snapshot_id');
    }
}
