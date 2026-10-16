<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CrmSuburb extends Model
{
    protected $fillable = ['crm_region_id', 'agency_id', 'name', 'municipality', 'signal', 'angle', 'priority', 'stats'];

    protected function casts(): array
    {
        return ['stats' => 'array'];
    }

    public function region(): BelongsTo
    {
        return $this->belongsTo(CrmRegion::class, 'crm_region_id');
    }

    public function schemes(): HasMany
    {
        return $this->hasMany(CrmScheme::class);
    }

    /** Shared reference suburbs plus the agency's own. */
    public function scopeVisibleTo(Builder $query, int $agencyId): Builder
    {
        return $query->where(fn ($q) => $q->whereNull('agency_id')->orWhere('agency_id', $agencyId));
    }
}
