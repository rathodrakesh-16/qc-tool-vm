<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AiValidationTask extends Model
{
    protected $table = 'ai_validation_tasks';

    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;

    protected $fillable = [
        'id',
        'status',
        'total_batches',
        'completed_batches',
        'results',
        'warning',
        'expires_at',
        'created_at',
    ];

    protected $casts = [
        'results' => 'array',
        'expires_at' => 'datetime',
        'created_at' => 'datetime',
        'total_batches' => 'integer',
        'completed_batches' => 'integer',
    ];
}
