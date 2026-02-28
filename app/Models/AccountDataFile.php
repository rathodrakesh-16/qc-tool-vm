<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccountDataFile extends Model
{
    use HasFactory;

    protected $table = 'account_files';

    protected $fillable = [
        'account_id',
        'original_name',
        'stored_name',
        'disk',
        'path',
        'mime_type',
        'file_type',
        'size',
        'uploaded_by_user_id',
    ];

    protected $casts = [
        'account_id' => 'integer',
        'size' => 'integer',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'account_id', 'account_id');
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by_user_id', 'userId');
    }
}
