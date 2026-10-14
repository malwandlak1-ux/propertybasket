<?php

namespace App\Services;

use App\Models\Landlord;
use App\Models\Lease;
use App\Models\Listing;
use App\Models\MaintenanceInvoice;
use App\Models\RentPayment;
use App\Support\StatementRange;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Landlord (owner) statements on a cash basis:
 *   income   = rent actually received (rent_payments paid, dated paid_at)
 *   expenses = maintenance invoices paid on the landlord's properties (paid_at)
 *   net      = income − maintenance
 *
 * Used by the Finance page (summary, trend, per-property split, monthly list)
 * and the owner statement PDFs (full + monthly).
 *
 * Every method takes an optional $listingId to scope to one property; null
 * means the whole portfolio.
 */
class LandlordStatementService
{
    /** Period filters offered on the Finance page (see StatementRange). */
    public const RANGES = StatementRange::KEYS;

    public const RANGE_LABELS = StatementRange::LABELS;

    /**
     * [from, to] for a range filter: the last N calendar months including the
     * current one, or from the first lease start to today.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    public function period(Landlord $landlord, string $range, ?int $listingId = null): array
    {
        $to = CarbonImmutable::now()->endOfDay();
        $from = StatementRange::from($range) ?? $this->firstMonth($landlord, $listingId);

        return [$from, $to];
    }

    /** The property the filter points at, if it is one of this landlord's. */
    public function ownedListing(Landlord $landlord, ?int $listingId): ?Listing
    {
        return $listingId ? Listing::where('owner_type', Landlord::class)->where('owner_id', $landlord->id)->find($listingId) : null;
    }

    public function propertyName(?Listing $listing): ?string
    {
        return $listing ? $this->propertyLabel($listing) : null;
    }

    /** @return Collection<int, int> the landlord's property (listing) ids */
    public function listingIds(Landlord $landlord): Collection
    {
        return Listing::where('owner_type', Landlord::class)->where('owner_id', $landlord->id)->pluck('id');
    }

    /**
     * Chronological income/expense entries for the landlord.
     *
     * @return Collection<int, array{date: CarbonImmutable, type: string, description: string, property: string, reference: string, income: float, expense: float}>
     */
    public function entries(Landlord $landlord, ?int $listingId = null): Collection
    {
        $listingIds = $this->scopedIds($landlord, $listingId);
        $leaseIds = Lease::whereIn('listing_id', $listingIds)->pluck('id');

        $income = RentPayment::whereIn('lease_id', $leaseIds)
            ->where('status', 'paid')
            ->whereNotNull('paid_at')
            ->with(['lease.listing', 'lease.tenant'])
            ->get()
            ->map(fn (RentPayment $p) => [
                'date'        => CarbonImmutable::parse($p->paid_at),
                'type'        => 'income',
                'description' => 'Rent received — ' . CarbonImmutable::parse($p->period_month . '-01')->format('F Y')
                    . ($p->lease?->tenant ? ' · ' . $p->lease->tenant->name : ''),
                'property'    => $this->propertyLabel($p->lease?->listing),
                'reference'   => $p->paystack_reference ?: 'RCP-' . str_pad((string) $p->id, 6, '0', STR_PAD_LEFT),
                'income'      => (float) $p->amount,
                'expense'     => 0.0,
            ]);

        $expenses = MaintenanceInvoice::where('status', 'paid')
            ->whereNotNull('paid_at')
            ->whereHas('request', fn ($q) => $q->whereIn('property_id', $listingIds))
            ->with(['request.property', 'contractor'])
            ->get()
            ->map(fn (MaintenanceInvoice $i) => [
                'date'        => CarbonImmutable::parse($i->paid_at),
                'type'        => 'maintenance',
                'description' => 'Maintenance — ' . ($i->request?->title ?? 'Job #' . $i->maintenance_request_id)
                    . ($i->contractor?->business_name ? ' · ' . $i->contractor->business_name : ''),
                'property'    => $this->propertyLabel($i->request?->property),
                'reference'   => 'INV-' . str_pad((string) $i->id, 6, '0', STR_PAD_LEFT),
                'income'      => 0.0,
                'expense'     => (float) $i->invoice_total,
            ]);

        return $income->concat($expenses)->sortBy(fn ($e) => $e['date']->format('YmdHis'))->values();
    }

    /**
     * Statement for [from, to].
     *
     * @return array{from: CarbonImmutable, to: CarbonImmutable, income: float, maintenance: float, net: float, lines: array, by_property: array}
     */
    public function build(Landlord $landlord, CarbonImmutable $from, CarbonImmutable $to, ?int $listingId = null): array
    {
        $lines = [];
        $running = 0.0;
        foreach ($this->entries($landlord, $listingId)->filter(fn ($e) => $e['date']->between($from, $to)) as $e) {
            $running += $e['income'] - $e['expense'];
            $lines[] = $e + ['net' => round($running, 2)];
        }

        $income = round((float) collect($lines)->sum('income'), 2);
        $maintenance = round((float) collect($lines)->sum('expense'), 2);

        $byProperty = collect($lines)->groupBy('property')->map(fn ($g, $property) => [
            'property'    => $property,
            'income'      => round((float) $g->sum('income'), 2),
            'maintenance' => round((float) $g->sum('expense'), 2),
            'net'         => round((float) ($g->sum('income') - $g->sum('expense')), 2),
        ])->values()->all();

        return [
            'from'        => $from,
            'to'          => $to,
            'income'      => $income,
            'maintenance' => $maintenance,
            'net'         => round($income - $maintenance, 2),
            'lines'       => $lines,
            'by_property' => $byProperty,
        ];
    }

    public function firstMonth(Landlord $landlord, ?int $listingId = null): CarbonImmutable
    {
        $start = Lease::whereIn('listing_id', $this->scopedIds($landlord, $listingId))->min('start_date');

        return CarbonImmutable::parse($start ?? now())->startOfMonth();
    }

    public function full(Landlord $landlord, ?int $listingId = null): array
    {
        return $this->build($landlord, $this->firstMonth($landlord, $listingId), CarbonImmutable::now()->endOfDay(), $listingId);
    }

    public function month(Landlord $landlord, string $period, ?int $listingId = null): array
    {
        $start = CarbonImmutable::createFromFormat('Y-m-d', $period . '-01')->startOfDay();

        return $this->build($landlord, $start, $start->endOfMonth(), $listingId);
    }

    /** @return array<int, array{period: string, label: string, income: float, maintenance: float, net: float}> newest first */
    public function availableMonths(Landlord $landlord, ?int $listingId = null, ?CarbonImmutable $from = null): array
    {
        $entries = $this->entries($landlord, $listingId);
        $first = $this->firstMonth($landlord, $listingId);
        if ($from && $from->startOfMonth()->gt($first)) {
            $first = $from->startOfMonth();
        }
        $months = [];
        for ($m = CarbonImmutable::now()->startOfMonth(); $m->gte($first); $m = $m->subMonth()) {
            $in = $entries->filter(fn ($e) => $e['date']->isSameMonth($m));
            $income = round((float) $in->sum('income'), 2);
            $maint = round((float) $in->sum('expense'), 2);
            $months[] = [
                'period'      => $m->format('Y-m'),
                'label'       => $m->format('F Y'),
                'income'      => $income,
                'maintenance' => $maint,
                'net'         => round($income - $maint, 2),
            ];
        }

        return $months;
    }

    /** All the landlord's property ids, or just the one being filtered on. */
    private function scopedIds(Landlord $landlord, ?int $listingId): Collection
    {
        $ids = $this->listingIds($landlord);

        return $listingId ? $ids->filter(fn ($id) => (int) $id === $listingId)->values() : $ids;
    }

    private function propertyLabel(?Listing $listing): string
    {
        if (! $listing) {
            return 'Property';
        }

        return $listing->address ?: $listing->title;
    }
}
