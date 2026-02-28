<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PdmFeedbackHistory extends Model
{
    use HasFactory;

    protected $table = 'pdm_feedback_history';
    public $timestamps = false;

    protected $fillable = [
        'pdm_id',
        'feedback_user_id',
        'feedback_at',
        'updated_description',
        'comment',
        'errors_json',
    ];

    protected $casts = [
        'pdm_id' => 'integer',
        'feedback_at' => 'datetime',
        'errors_json' => 'array',
    ];

    public function pdm(): BelongsTo
    {
        return $this->belongsTo(Pdm::class, 'pdm_id', 'pdm_id');
    }

    public function feedbackUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'feedback_user_id', 'userId');
    }
}
