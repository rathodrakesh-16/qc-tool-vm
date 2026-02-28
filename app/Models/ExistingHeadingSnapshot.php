<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ExistingHeadingSnapshot extends Model
{
    use HasFactory;

    protected $table = 'existing_heading_snapshots';
    public $timestamps = false;

    protected $fillable = [
        'account_id',
        'file_name',
        'uploaded_by_user_id',
        'uploaded_at',
        'is_active',
    ];

    protected $casts = [
        'account_id' => 'integer',
        'uploaded_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'account_id', 'account_id');
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by_user_id', 'userId');
    }

    public function items(): HasMany
    {
        return $this->hasMany(ExistingHeadingSnapshotItem::class, 'snapshot_id');
    }
}
