<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PdmQcFeedbackError extends Model
{
    use HasFactory;

    protected $table = 'pdm_qc_feedback_errors';
    public $timestamps = false;

    protected $fillable = [
        'feedback_id',
        'error_category',
    ];

    protected $casts = [
        'feedback_id' => 'integer',
    ];

    public function feedback(): BelongsTo
    {
        return $this->belongsTo(PdmQcFeedback::class, 'feedback_id');
    }
}
