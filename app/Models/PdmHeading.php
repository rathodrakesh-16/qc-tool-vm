<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PdmHeading extends Model
{
    use HasFactory;

    protected $table = 'pdm_headings';
    public $timestamps = false;

    protected $fillable = [
        'pdm_id',
        'heading_id',
        'sort_order',
    ];

    protected $casts = [
        'pdm_id' => 'integer',
        'heading_id' => 'integer',
        'sort_order' => 'integer',
    ];

    public function pdm(): BelongsTo
    {
        return $this->belongsTo(Pdm::class, 'pdm_id', 'pdm_id');
    }

    public function heading(): BelongsTo
    {
        return $this->belongsTo(Heading::class, 'heading_id', 'heading_id');
    }
}
