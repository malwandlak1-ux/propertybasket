<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DebitOrder extends Model
{
    protected $fillable = [
        'lease_id', 'tenant_id',
        'bank_name', 'account_holder', 'account_number', 'branch_code', 'account_type',
        'debit_day', 'collect_from', 'status',
        'signed_at', 'cancelled_at',
    ];

    protected function casts(): array
    {
        return [
            'signed_at'    => 'datetime',
            'cancelled_at' => 'datetime',
            'debit_day'    => 'integer',
            'collect_from' => 'date',
        ];
    }

    public function lease(): BelongsTo
    {
        return $this->belongsTo(Lease::class);
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'tenant_id');
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function collections(): HasMany
    {
        return $this->hasMany(DebitOrderCollection::class);
    }

    /** Rent charges due on/after this date are collected by this mandate. */
    public function collectsFrom(): CarbonImmutable
    {
        return CarbonImmutable::parse($this->collect_from ?? $this->signed_at ?? $this->created_at)->startOfDay();
    }

    /** This month's debit date (the debit day, capped to the month's length). */
    public function debitDateIn(CarbonImmutable $month): CarbonImmutable
    {
        $m = $month->startOfMonth();

        return $m->day(min($this->debit_day, $m->daysInMonth));
    }

    /**
     * The next date this mandate will run: today or later, and past this
     * month's debit date once this month's collection has been attempted.
     */
    public function nextDebitDate(?CarbonImmutable $today = null): CarbonImmutable
    {
        $today = ($today ?? CarbonImmutable::now())->startOfDay();
        $from  = $this->collectsFrom()->max($today);
        $date  = $this->debitDateIn($from);

        $ranThisMonth = $date->lte($today) && DebitOrderCollection::where('lease_id', $this->lease_id)
            ->whereDate('attempted_at', '>=', $date->toDateString())
            ->exists();

        return $date->lt($from) || $ranThisMonth ? $this->debitDateIn($from->startOfMonth()->addMonth()) : $date;
    }
}
