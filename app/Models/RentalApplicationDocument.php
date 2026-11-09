<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RentalApplicationDocument extends Model
{
    protected $fillable = ['rental_application_id', 'kind', 'path', 'original_name', 'mime', 'size'];

    public function application(): BelongsTo
    {
        return $this->belongsTo(RentalApplication::class, 'rental_application_id');
    }
}
