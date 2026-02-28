<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

class Account extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'accounts';
    protected $primaryKey = 'account_id';
    public $incrementing = false;
    protected $keyType = 'int';

    protected $fillable = [
        'account_id',
        'account_name',
        'editor_user_id',
        'qc_user_id',
        'status',
        'assigned_date',
        'delivery_date',
        'is_system',
        'created_by_user_id',
        'updated_by_user_id',
    ];

    protected $casts = [
        'account_id' => 'integer',
        'assigned_date' => 'date',
        'delivery_date' => 'date',
        'is_system' => 'boolean',
    ];

    public function editorUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'editor_user_id', 'userId');
    }

    public function qcUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'qc_user_id', 'userId');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id', 'userId');
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by_user_id', 'userId');
    }

    public function files(): HasMany
    {
        return $this->hasMany(AccountDataFile::class, 'account_id', 'account_id');
    }

    public function notes(): HasMany
    {
        return $this->hasMany(AccountNote::class, 'account_id', 'account_id');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(AccountComment::class, 'account_id', 'account_id');
    }

    public function headings(): HasMany
    {
        return $this->hasMany(Heading::class, 'account_id', 'account_id');
    }

    public function pdms(): HasMany
    {
        return $this->hasMany(Pdm::class, 'account_id', 'account_id');
    }

    public function importBatches(): HasMany
    {
        return $this->hasMany(ImportBatch::class, 'account_id', 'account_id');
    }

    public function activityLogs(): HasMany
    {
        return $this->hasMany(ActivityLog::class, 'account_id', 'account_id');
    }

    public function qcErrors(): HasMany
    {
        return $this->hasMany(QcError::class, 'account_id', 'account_id');
    }

    public function existingHeadingSnapshots(): HasMany
    {
        return $this->hasMany(ExistingHeadingSnapshot::class, 'account_id', 'account_id');
    }

    protected static function booted(): void
    {
        static::deleted(function (Account $account) {
            $account->files()->delete();
            $account->notes()->delete();
            $account->comments()->delete();
            $account->headings()->delete();
            $account->pdms()->delete();
            $account->importBatches()->delete();
            $account->activityLogs()->delete();
            $account->qcErrors()->delete();
            $account->existingHeadingSnapshots()->delete();

            Storage::disk('local')->deleteDirectory("account_files/{$account->account_id}");
        });
    }
}
