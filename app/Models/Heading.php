<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Heading extends Model
{
    use HasFactory;

    protected $table = 'headings';
    protected $primaryKey = 'heading_id';
    public $incrementing = false;
    protected $keyType = 'int';

    protected $fillable = [
        'heading_id',
        'account_id',
        'heading_name',
        'families_json',
        'grouping_family',
        'supported_link',
        'workflow_stage',
        'status',
        'rank_points',
        'heading_type',
        'source_status',
        'source_updated_at',
        'definition',
        'aliases',
        'category',
        'companies',
        'created_by_user_id',
        'updated_by_user_id',
    ];

    protected $casts = [
        'heading_id' => 'integer',
        'account_id' => 'integer',
        'families_json' => 'array',
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

    public function families(): HasMany
    {
        return $this->hasMany(HeadingFamily::class, 'heading_id', 'heading_id');
    }

    public function importBatchItems(): HasMany
    {
        return $this->hasMany(ImportBatchItem::class, 'heading_id', 'heading_id');
    }

    public function pdmHeadings(): HasMany
    {
        return $this->hasMany(PdmHeading::class, 'heading_id', 'heading_id');
    }
}
