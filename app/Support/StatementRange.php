<?php

namespace App\Support;

use Carbon\CarbonImmutable;

/**
 * Period filters shared by the landlord Finance page and the tenant Payments
 * page (and their statement PDFs): the last 3 / 6 / 12 calendar months
 * including the current one, or the full lease period.
 */
class StatementRange
{
    public const KEYS = ['3', '6', '12', 'lease'];

    public const LABELS = [
        '3'     => 'Last 3 months',
        '6'     => 'Last 6 months',
        '12'    => 'Last 12 months',
        'lease' => 'Full lease period',
    ];

    public static function valid(?string $range): bool
    {
        return in_array($range, self::KEYS, true);
    }

    /** Start of a month-count range; null for 'lease' (the caller knows the lease start). */
    public static function from(string $range): ?CarbonImmutable
    {
        return $range === 'lease' ? null : CarbonImmutable::now()->startOfMonth()->subMonths(max(1, (int) $range) - 1);
    }

    /** @return array<int, array{key: string, label: string}> for the UI */
    public static function options(): array
    {
        return collect(self::LABELS)->map(fn ($label, $key) => ['key' => (string) $key, 'label' => $label])->values()->all();
    }
}
