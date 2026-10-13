<?php

namespace App\Services;

use App\Models\Landlord;
use App\Models\Lease;
use App\Models\Listing;
use App\Models\MaintenanceInvoice;
use App\Models\RentPayment;
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
 */
class LandlordStatementService
{
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
    public function entries(Landlord $landlord): Collection
    {
        $listingIds = $this->listingIds($landlord);
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
    public function build(Landlord $landlord, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $lines = [];
        $running = 0.0;
        foreach ($this->entries($landlord)->filter(fn ($e) => $e['date']->between($from, $to)) as $e) {
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

    public function firstMonth(Landlord $landlord): CarbonImmutable
    {
        $start = Lease::whereIn('listing_id', $this->listingIds($landlord))->min('start_date');

        return CarbonImmutable::parse($start ?? now())->startOfMonth();
    }

    public function full(Landlord $landlord): array
    {
        return $this->build($landlord, $this->firstMonth($landlord), CarbonImmutable::now()->endOfDay());
    }

    public function month(Landlord $landlord, string $period): array
    {
        $start = CarbonImmutable::createFromFormat('Y-m-d', $period . '-01')->startOfDay();

        return $this->build($landlord, $start, $start->endOfMonth());
    }

    /** @return array<int, array{period: string, label: string, income: float, maintenance: float, net: float}> newest first */
    public function availableMonths(Landlord $landlord): array
    {
        $entries = $this->entries($landlord);
        $months = [];
        for ($m = CarbonImmutable::now()->startOfMonth(), $first = $this->firstMonth($landlord); $m->gte($first); $m = $m->subMonth()) {
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

    private function propertyLabel(?Listing $listing): string
    {
        if (! $listing) {
            return 'Property';
        }

        return $listing->address ?: $listing->title;
    }
}
