<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A sectional-title scheme (or any farmed block) worked by one agent. */
class CrmScheme extends Model
{
    protected $fillable = ['crm_suburb_id', 'agency_id', 'agent_id', 'name', 'scheme_number', 'erf', 'address', 'units_count'];

    public function suburb(): BelongsTo
    {
        return $this->belongsTo(CrmSuburb::class, 'crm_suburb_id');
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'agent_id');
    }

    public function prospects(): HasMany
    {
        return $this->hasMany(CrmProspect::class);
    }
}
