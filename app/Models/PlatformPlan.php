<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PlatformPlan extends Model
{
    protected $fillable = [
        'key', 'name', 'audience', 'price', 'headline',
        'features', 'is_popular', 'sort_order', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'features'    => 'array',
            'is_popular'  => 'boolean',
            'is_active'   => 'boolean',
            'price'       => 'integer',
            'sort_order'  => 'integer',
        ];
    }
}
