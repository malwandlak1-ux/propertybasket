<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** An owner on a farmed scheme's register, tracked through outreach. */
class CrmProspect extends Model
{
    protected $fillable = [
        'crm_scheme_id', 'agency_id', 'agent_id',
        'unit', 'size', 'owner_name', 'owner_type', 'id_reg', 'multi_unit',
        'phone1', 'phone2', 'email', 'priority_note',
        'status', 'method', 'contacted_on', 'est_value', 'response', 'next_action', 'notes',
        'inquiry_id',
    ];

    protected function casts(): array
    {
        return [
            'contacted_on' => 'date',
            'est_value'    => 'decimal:2',
        ];
    }

    public function scheme(): BelongsTo
    {
        return $this->belongsTo(CrmScheme::class, 'crm_scheme_id');
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'agent_id');
    }

    public function inquiry(): BelongsTo
    {
        return $this->belongsTo(Inquiry::class);
    }

    public function activities(): HasMany
    {
        return $this->hasMany(CrmActivity::class);
    }
}
