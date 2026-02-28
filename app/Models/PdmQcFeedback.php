<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PdmQcFeedback extends Model
{
    use HasFactory;

    protected $table = 'pdm_qc_feedback';

    protected $fillable = [
        'pdm_id',
        'updated_description',
        'comment',
        'feedback_user_id',
        'feedback_at',
    ];

    protected $casts = [
        'pdm_id' => 'integer',
        'feedback_at' => 'datetime',
    ];

    public function pdm(): BelongsTo
    {
        return $this->belongsTo(Pdm::class, 'pdm_id', 'pdm_id');
    }

    public function feedbackUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'feedback_user_id', 'userId');
    }

    public function errors(): HasMany
    {
        return $this->hasMany(PdmQcFeedbackError::class, 'feedback_id');
    }
}
