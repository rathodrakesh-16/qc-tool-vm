<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ImportBatch extends Model
{
    use HasFactory;

    protected $table = 'import_batches';
    public $timestamps = false;

    protected $fillable = [
        'account_id',
        'context_family',
        'file_name',
        'headings_count',
        'imported_by_user_id',
        'imported_at',
    ];

    protected $casts = [
        'account_id' => 'integer',
        'headings_count' => 'integer',
        'imported_at' => 'datetime',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'account_id', 'account_id');
    }

    public function importedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'imported_by_user_id', 'userId');
    }

    public function items(): HasMany
    {
        return $this->hasMany(ImportBatchItem::class, 'batch_id');
    }
}
