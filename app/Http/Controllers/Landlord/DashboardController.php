<?php

namespace App\Http\Controllers\Landlord;

use App\Http\Controllers\Landlord\Concerns\ResolvesLandlord;
use App\Models\Lease;
use App\Models\MaintenanceRequest;
use App\Models\RentPayment;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    use ResolvesLandlord;

    public function overview(Request $request): Response
    {
        $landlord = $this->resolveLandlord($request);
        $user     = $request->user();
        $now      = CarbonImmutable::now();
        $period   = $now->format('Y-m');

        // All long-term listings owned by this landlord
        $listings = $landlord->listings()
            ->where('listing_type', 'long_term_rent')
            ->with(['leases' => fn($q) => $q->where('status', 'active')->with(['tenant', 'rentPayments'])])
            ->get();

        $allListings = $landlord->listings()->get();

        // ── KPI calculations ──────────────────────────────────────────────
        $totalRentRoll  = 0;
        $occupiedCount  = 0;
        $properties     = [];

        foreach ($listings as $listing) {
            $activeLease = $listing->leases->first();
            $isOccupied  = $activeLease !== null;
            if ($isOccupied) {
                $occupiedCount++;
                $totalRentRoll += (float) $activeLease->monthly_rent;
            }

            // Current month payment status
            $currentPayment = $activeLease?->rentPayments
                ->where('period_month', $period)
                ->first();

            $payStatus = match (true) {
                $currentPayment === null           => 'no_lease',
                $currentPayment->paid_at !== null  => 'paid',
                Carbon::parse($currentPayment->due_date)->isPast() => 'overdue',
                default                            => 'due',
            };

            $properties[] = [
                'id'          => $listing->id,
                'title'       => $listing->title,
                'address'     => "{$listing->suburb}, {$listing->city}",
                'bedrooms'    => $listing->bedrooms,
                'status'      => $isOccupied ? 'occupied' : 'vacant',
                'monthly_rent'=> $isOccupied ? (float) $activeLease->monthly_rent : null,
                'tenant_name' => $activeLease?->tenant?->name,
                'tenant_initials' => $activeLease?->tenant?->name
                    ? collect(explode(' ', $activeLease->tenant->name))->map(fn($s) => $s[0])->slice(0, 2)->implode('')
                    : null,
                'lease_end'   => $activeLease?->end_date?->format('M Y'),
                'pay_status'  => $payStatus,
                'color_class' => $this->propertyColorClass($listing->id),
                'primary_image' => $listing->primary_image,
            ];
        }

        $totalLongTerm  = $listings->count();
        $occupancyPct   = $totalLongTerm > 0 ? round($occupiedCount / $totalLongTerm * 100) : 0;

        // ── Open maintenance ──────────────────────────────────────────────
        $listingIds = $allListings->pluck('id');
        $openMaint  = MaintenanceRequest::whereIn('property_id', $listingIds)
            ->whereNotIn('status', ['completed', 'paid'])
            ->count();

        $needsQuoteCount = MaintenanceRequest::whereIn('property_id', $listingIds)
            ->where('status', 'open')
            ->whereDoesntHave('quotes')
            ->count();

        // ── This month summary ────────────────────────────────────────────
        $leaseIds       = Lease::whereIn('listing_id', $listingIds)->where('status', 'active')->pluck('id');
        $thisMonthPaid  = RentPayment::whereIn('lease_id', $leaseIds)
            ->where('period_month', $period)
            ->whereNotNull('paid_at')
            ->sum('amount');
        $thisMonthDue   = RentPayment::whereIn('lease_id', $leaseIds)
            ->where('period_month', $period)
            ->whereNull('paid_at')
            ->sum('amount');

        // ── Needs-attention items ─────────────────────────────────────────
        $attention = [];
        foreach ($listings as $listing) {
            $lease = $listing->leases->first();
            if (! $lease) {
                continue;
            }
            $daysLeft = $now->diffInDays($lease->end_date, false);
            if ($daysLeft > 0 && $daysLeft <= 90) {
                $attention[] = [
                    'type'    => 'lease_expiring',
                    'label'   => "Lease expiring · {$listing->suburb}",
                    'detail'  => "{$lease->tenant?->name} · {$lease->end_date->format('d M Y')} · {$daysLeft} days",
                    'tone'    => $daysLeft <= 30 ? 'danger' : 'warning',
                ];
            }
        }
        // Maintenance open items needing attention
        $urgentMaint = MaintenanceRequest::whereIn('property_id', $listingIds)
            ->where('status', 'open')
            ->with('property')
            ->orderByRaw("CASE urgency WHEN 'emergency' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END")
            ->first();
        if ($urgentMaint) {
            $attention[] = [
                'type'   => 'maintenance',
                'label'  => 'Maintenance open · ' . $urgentMaint->property?->suburb,
                'detail' => $urgentMaint->title,
                'tone'   => 'warning',
            ];
        }

        return Inertia::render('Landlord/Overview', [
            'landlord'      => ['id' => $landlord->id, 'name' => $user->name],
            'kpis'          => [
                'rent_roll'      => $totalRentRoll,
                'occupancy_pct'  => $occupancyPct,
                'occupied_count' => $occupiedCount,
                'total_count'    => $totalLongTerm,
                'all_count'      => $allListings->count(),
                'open_maint'     => $openMaint,
                'needs_quote'    => $needsQuoteCount,
            ],
            'properties'    => $properties,
            'attention'     => $attention,
            'this_month'    => [
                'collected'   => (float) $thisMonthPaid,
                'outstanding' => (float) $thisMonthDue,
                'net'         => (float) ($thisMonthPaid - $thisMonthDue),
            ],
            'invitable_listings' => TenantsController::invitableListings($landlord),
            'pending_invites'    => TenantsController::pendingInvites($landlord),
        ]);
    }

    private function propertyColorClass(int $id): string
    {
        $colors = [
            'from-amber-300 to-orange-400',
            'from-sky-300 to-cyan-400',
            'from-emerald-300 to-teal-400',
            'from-violet-300 to-purple-400',
            'from-rose-300 to-pink-400',
        ];
        return $colors[$id % count($colors)];
    }
}
