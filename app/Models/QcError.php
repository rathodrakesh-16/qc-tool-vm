<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QcError extends Model
{
    use HasFactory;

    protected $table = 'qc_errors';

    protected $fillable = [
        'account_id',
        'heading_id',
        'error_category',
        'comment',
        'qc_status',
        'rectification_status',
        'validation_status',
        'reported_by_user_id',
        'reported_at',
        'resolved_at',
    ];

    protected $casts = [
        'account_id' => 'integer',
        'heading_id' => 'integer',
        'reported_at' => 'datetime',
        'resolved_at' => 'datetime',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'account_id', 'account_id');
    }

    public function heading(): BelongsTo
    {
        return $this->belongsTo(Heading::class, 'heading_id', 'heading_id');
    }

    public function reportedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reported_by_user_id', 'userId');
    }
}
