<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccountComment extends Model
{
    use HasFactory;

    protected $table = 'account_comments';

    protected $fillable = [
        'account_id',
        'text',
        'user_id',
    ];

    protected $casts = [
        'account_id' => 'integer',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'account_id', 'account_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id', 'userId');
    }
}
