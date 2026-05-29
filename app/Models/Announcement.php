<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Announcement extends Model
{
    protected $fillable = [
        'created_by', 'title', 'body', 'audience',
        'send_email', 'show_banner', 'published_at',
    ];

    protected function casts(): array
    {
        return [
            'send_email' => 'boolean',
            'show_banner' => 'boolean',
            'published_at' => 'datetime',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
