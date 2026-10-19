<?php

namespace App\Services;

use App\Models\FacilityEntry;
use App\Models\Landlord;
use App\Models\Listing;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Facility operations ledger: operating expenses and other income, kept
 * apart from rent and maintenance (which stay in LandlordStatementService).
 * Shared by the landlord's Operations tab, its CSV and the integration API.
 */
class FacilityLedgerService
{
    public const EXPENSE_CATEGORIES = [
        'kitchen'       => 'Kitchen facility maintenance',
        'rates'         => 'Rates & taxes',
        'electricity'   => 'Municipal: electricity',
        'water'         => 'Municipal: water',
        'gardening'     => 'Gardening services',
        'other_expense' => 'Other operating expense',
    ];

    public const INCOME_CATEGORIES = [
        'hospital_services' => 'Hospital services',
        'canteen'           => 'Kitchen / canteen sales',
        'parking'           => 'Parking',
        'facility_hire'     => 'Facility / room hire',
        'other_income'      => 'Other income',
    ];

    public const RANGES = [
        '1'   => 'This month',
        '3'   => 'Last 3 months',
        '6'   => 'Last 6 months',
        '12'  => 'Last 12 months',
        'all' => 'All time',
    ];

    public static function categories(string $type): array
    {
        return $type === 'income' ? self::INCOME_CATEGORIES : self::EXPENSE_CATEGORIES;
    }

    public static function categoryLabel(string $type, string $key): string
    {
        return self::categories($type)[$key] ?? ucfirst(str_replace('_', ' ', $key));
    }

    /** 'lease' (the statements' name for everything) is accepted as all time. */
    public static function normaliseRange(?string $range): ?string
    {
        $range = $range === 'lease' ? 'all' : $range;

        return array_key_exists((string) $range, self::RANGES) ? (string) $range : null;
    }

    /** @return array{0: CarbonImmutable, 1: CarbonImmutable} */
    public function period(Landlord $landlord, string $range): array
    {
        $to = CarbonImmutable::now()->endOfDay();
        if ($range === 'all') {
            $first = FacilityEntry::where('landlord_id', $landlord->id)->min('entry_date');

            return [CarbonImmutable::parse($first ?? now())->startOfMonth(), $to];
        }

        return [CarbonImmutable::now()->startOfMonth()->subMonths(max(1, (int) $range) - 1), $to];
    }

    /**
     * Entries in a period. $property: null = everything, 'facility' = whole-
     * facility entries only, or a listing id.
     *
     * @return Collection<int, FacilityEntry>
     */
    public function entries(Landlord $landlord, CarbonImmutable $from, CarbonImmutable $to, int|string|null $property = null, ?string $type = null): Collection
    {
        return FacilityEntry::where('landlord_id', $landlord->id)
            ->whereDate('entry_date', '>=', $from->toDateString())
            ->whereDate('entry_date', '<=', $to->toDateString())
            ->when($property === 'facility', fn ($q) => $q->whereNull('listing_id'))
            ->when(is_int($property), fn ($q) => $q->where('listing_id', $property))
            ->when($type, fn ($q) => $q->where('type', $type))
            ->with('listing:id,title,address')
            ->orderBy('entry_date')->orderBy('id')
            ->get();
    }

    /** Totals, per-category split and a month-by-month series for a set of entries. */
    public function summary(Collection $entries, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $income = round((float) $entries->where('type', 'income')->sum('amount'), 2);
        $expenses = round((float) $entries->where('type', 'expense')->sum('amount'), 2);

        $byCategory = function (string $type) use ($entries) {
            $rows = $entries->where('type', $type);
            $total = (float) $rows->sum('amount');

            return collect(self::categories($type))->keys()
                ->merge($rows->pluck('category'))->unique()
                ->map(function ($key) use ($rows, $type, $total) {
                    $amount = round((float) $rows->where('category', $key)->sum('amount'), 2);

                    return [
                        'category' => $key,
                        'label'    => self::categoryLabel($type, $key),
                        'amount'   => $amount,
                        'count'    => $rows->where('category', $key)->count(),
                        'share'    => $total > 0 ? round($amount / $total * 100, 1) : 0.0,
                    ];
                })
                ->filter(fn ($r) => $r['amount'] > 0 || array_key_exists($r['category'], self::categories($type)))
                ->sortByDesc('amount')->values()->all();
        };

        $months = [];
        for ($m = $from->startOfMonth(); $m <= $to; $m = $m->addMonth()) {
            $key = $m->format('Y-m');
            $inMonth = $entries->filter(fn (FacilityEntry $e) => $e->entry_date->format('Y-m') === $key);
            $mi = round((float) $inMonth->where('type', 'income')->sum('amount'), 2);
            $me = round((float) $inMonth->where('type', 'expense')->sum('amount'), 2);
            $months[] = ['month' => $key, 'label' => $m->format('M Y'), 'income' => $mi, 'expenses' => $me, 'net' => round($mi - $me, 2)];
        }

        return [
            'totals' => [
                'other_income'       => $income,
                'operating_expenses' => $expenses,
                'net'                => round($income - $expenses, 2),
                'coverage_pct'       => $expenses > 0 ? round($income / $expenses * 100, 1) : null,
            ],
            'expenses_by_category' => $byCategory('expense'),
            'income_by_category'   => $byCategory('income'),
            'months'               => $months,
        ];
    }

    public function line(FacilityEntry $e): array
    {
        return [
            'id'           => $e->id,
            'date'         => $e->entry_date->toDateString(),
            'type'         => $e->type,
            'category'     => $e->category,
            'category_label' => self::categoryLabel($e->type, $e->category),
            'description'  => $e->description,
            'property_id'  => $e->listing_id,
            'property'     => $e->listing ? ($e->listing->address ?: $e->listing->title) : 'Whole facility',
            'counterparty' => $e->counterparty,
            'reference'    => $e->reference,
            'notes'        => $e->notes,
            'amount'       => (float) $e->amount,
            'has_attachment' => (bool) $e->attachment_path,
            'attachment_name' => $e->attachment_name,
        ];
    }

    /** The landlord's properties for the filter / form. */
    public function properties(Landlord $landlord): Collection
    {
        return Listing::where('owner_type', Landlord::class)->where('owner_id', $landlord->id)
            ->orderBy('title')->get(['id', 'title', 'address'])
            ->map(fn ($l) => ['id' => $l->id, 'name' => $l->address ?: $l->title]);
    }
}
