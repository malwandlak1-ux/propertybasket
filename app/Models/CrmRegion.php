<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CrmRegion extends Model
{
    protected $fillable = ['agency_id', 'slug', 'name', 'sort'];

    public function suburbs(): HasMany
    {
        return $this->hasMany(CrmSuburb::class);
    }

    /** Shared reference regions plus the agency's own. */
    public function scopeVisibleTo(Builder $query, int $agencyId): Builder
    {
        return $query->where(fn ($q) => $q->whereNull('agency_id')->orWhere('agency_id', $agencyId));
    }
}
