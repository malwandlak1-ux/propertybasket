<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A catalogue/brochure an agent uploads once and sends into WhatsApp chats. */
class WaCatalogue extends Model
{
    protected $fillable = ['agent_id', 'title', 'description', 'path', 'original_name', 'mime', 'size', 'sent_count', 'last_sent_at'];

    protected function casts(): array
    {
        return ['last_sent_at' => 'datetime', 'size' => 'integer', 'sent_count' => 'integer'];
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'agent_id');
    }

    /** image | video | document — how it shows in the library. */
    public function kind(): string
    {
        return match (true) {
            str_starts_with($this->mime, 'image/') => 'image',
            str_starts_with($this->mime, 'video/') => 'video',
            default => 'document',
        };
    }
}
