<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ImportBatchItem extends Model
{
    use HasFactory;

    protected $table = 'import_batch_items';
    public $timestamps = false;

    protected $fillable = [
        'batch_id',
        'heading_id',
    ];

    protected $casts = [
        'batch_id' => 'integer',
        'heading_id' => 'integer',
    ];

    public function batch(): BelongsTo
    {
        return $this->belongsTo(ImportBatch::class, 'batch_id');
    }

    public function heading(): BelongsTo
    {
        return $this->belongsTo(Heading::class, 'heading_id', 'heading_id');
    }
}
