<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PdmStatusEvent extends Model
{
    use HasFactory;

    protected $table = 'pdm_status_events';
    public $timestamps = false;

    protected $fillable = [
        'pdm_id',
        'event_type',
        'from_state',
        'to_state',
        'actor_user_id',
        'created_at',
    ];

    protected $casts = [
        'pdm_id' => 'integer',
        'from_state' => 'array',
        'to_state' => 'array',
        'created_at' => 'datetime',
    ];

    public function pdm(): BelongsTo
    {
        return $this->belongsTo(Pdm::class, 'pdm_id', 'pdm_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id', 'userId');
    }
}
