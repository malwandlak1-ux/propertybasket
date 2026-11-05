<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A reminder an agent puts on their own calendar. */
class AgentReminder extends Model
{
    protected $fillable = ['agent_id', 'title', 'notes', 'remind_at', 'notified_at', 'done_at'];

    protected $casts = [
        'remind_at'   => 'datetime',
        'notified_at' => 'datetime',
        'done_at'     => 'datetime',
    ];

    public function agent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'agent_id');
    }
}
