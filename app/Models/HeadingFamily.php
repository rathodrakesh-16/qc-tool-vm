<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HeadingFamily extends Model
{
    use HasFactory;

    protected $table = 'heading_families';
    public $timestamps = false;

    protected $fillable = [
        'heading_id',
        'family_name',
    ];

    protected $casts = [
        'heading_id' => 'integer',
    ];

    public function heading(): BelongsTo
    {
        return $this->belongsTo(Heading::class, 'heading_id', 'heading_id');
    }
}
