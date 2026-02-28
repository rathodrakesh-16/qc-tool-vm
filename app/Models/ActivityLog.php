<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActivityLog extends Model
{
    use HasFactory;

    protected $table = 'activity_logs';
    public $timestamps = false;

    protected $fillable = [
        'account_id',
        'action',
        'details',
        'actor_user_id',
        'entity_type',
        'entity_id',
        'created_at',
    ];

    protected $casts = [
        'account_id' => 'integer',
        'created_at' => 'datetime',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'account_id', 'account_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id', 'userId');
    }
}
