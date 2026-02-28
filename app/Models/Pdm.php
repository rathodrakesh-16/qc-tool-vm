<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Pdm extends Model
{
    use HasFactory;

    protected $table = 'pdms';
    protected $primaryKey = 'pdm_id';
    public $incrementing = false;
    protected $keyType = 'int';

    protected $fillable = [
        'pdm_id',
        'account_id',
        'is_copro',
        'url',
        'company_type',
        'type_of_proof',
        'description',
        'comment',
        'word_count',
        'uploaded',
        'qc_status',
        'rectification_status',
        'validation_status',
        'is_qc_edited',
        'is_description_updated',
        'created_by_user_id',
        'updated_by_user_id',
    ];

    protected $casts = [
        'pdm_id' => 'integer',
        'account_id' => 'integer',
        'is_copro' => 'boolean',
        'company_type' => 'array',
        'word_count' => 'integer',
        'uploaded' => 'boolean',
        'is_qc_edited' => 'boolean',
        'is_description_updated' => 'boolean',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'account_id', 'account_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id', 'userId');
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by_user_id', 'userId');
    }

    public function pdmHeadings(): HasMany
    {
        return $this->hasMany(PdmHeading::class, 'pdm_id', 'pdm_id');
    }

    public function qcFeedback(): HasOne
    {
        return $this->hasOne(PdmQcFeedback::class, 'pdm_id', 'pdm_id');
    }

    public function feedbackHistory(): HasMany
    {
        return $this->hasMany(PdmFeedbackHistory::class, 'pdm_id', 'pdm_id');
    }

    public function statusEvents(): HasMany
    {
        return $this->hasMany(PdmStatusEvent::class, 'pdm_id', 'pdm_id');
    }
}
