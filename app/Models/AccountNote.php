<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccountNote extends Model
{
    use HasFactory;

    protected $table = 'account_notes';

    protected $fillable = [
        'account_id',
        'subject',
        'content',
        'created_by_user_id',
        'updated_by_user_id',
    ];

    protected $casts = [
        'account_id' => 'integer',
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
}
