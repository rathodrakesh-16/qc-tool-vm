<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkspaceUserPreference extends Model
{
    use HasFactory;

    protected $table = 'workspace_user_preferences';
    protected $primaryKey = 'user_id';
    public $incrementing = false;
    protected $keyType = 'string';

    const CREATED_AT = null;

    protected $fillable = [
        'user_id',
        'last_account_id',
        'active_mode',
        'active_route',
        'filters_json',
    ];

    protected $casts = [
        'last_account_id' => 'integer',
        'filters_json' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id', 'userId');
    }

    public function lastAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'last_account_id', 'account_id');
    }
}
