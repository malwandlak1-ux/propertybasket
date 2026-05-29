<?php

namespace App\Http\Controllers\Landlord;

use App\Http\Controllers\Landlord\Concerns\ResolvesLandlord;
use App\Models\Lease;
use App\Models\RentPayment;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Inertia\Inertia;
use Inertia\Response;

class FinanceController extends Controller
{
    use ResolvesLandlord;

    public function index(Request $request): Response
    {
        $landlord   = $this->resolveLandlord($request);
        $now        = CarbonImmutable::now();
        $period     = $now->format('Y-m');
        $yearStart  = $now->startOfYear();

        $listingIds = $landlord->listings()->where('listing_type', 'long_term_rent')->pluck('id');
        $leaseIds   = Lease::whereIn('listing_id', $listingIds)->where('status', 'active')->pluck('id');

        // ── KPIs ──────────────────────────────────────────────────────────
        $monthlyRentRoll = Lease::whereIn('id', $leaseIds)->sum('monthly_rent');

        $ytdCollected = RentPayment::whereIn('lease_id', $leaseIds)
            ->whereNotNull('paid_at')
            ->where('paid_at', '>=', $yearStart)
            ->sum('amount');

        $thisMonthCollected = RentPayment::whereIn('lease_id', $leaseIds)
            ->where('period_month', $period)
            ->whereNotNull('paid_at')
            ->sum('amount');

        $outstanding = RentPayment::whereIn('lease_id', $leaseIds)
            ->whereNull('paid_at')
            ->where('due_date', '<=', $now)
            ->sum('amount');

        // ── Payment history ───────────────────────────────────────────────
        $payments = RentPayment::whereIn('lease_id', $leaseIds)
            ->with(['lease.listing', 'lease.tenant'])
            ->orderByDesc('due_date')
            ->limit(36)
            ->get()
            ->map(function ($p) {
                return [
                    'id'           => $p->id,
                    'period'       => $p->period_month,
                    'amount'       => (float) $p->amount,
                    'due_date'     => $p->due_date->format('d M Y'),
                    'paid_at'      => $p->paid_at?->format('d M Y'),
                    'status'       => $p->paid_at ? 'paid' : ($p->due_date->isPast() ? 'overdue' : 'pending'),
                    'property'     => $p->lease?->listing?->suburb,
                    'tenant'       => $p->lease?->tenant?->name,
                    'method'       => $p->payment_method ?? 'eft',
                    'reference'    => $p->paystack_reference,
                ];
            })
            ->values()
            ->all();

        // ── Monthly trend (last 6 months) ─────────────────────────────────
        $trend = [];
        for ($i = 5; $i >= 0; $i--) {
            $mo      = $now->subMonths($i);
            $p       = $mo->format('Y-m');
            $label   = $mo->format('M');
            $collected = RentPayment::whereIn('lease_id', $leaseIds)
                ->where('period_month', $p)
                ->whereNotNull('paid_at')
                ->sum('amount');
            $trend[] = ['label' => $label, 'period' => $p, 'collected' => (float) $collected];
        }

        return Inertia::render('Landlord/Finance', [
            'landlord'   => ['id' => $landlord->id, 'name' => $request->user()->name],
            'kpis'       => [
                'monthly_roll'        => (float) $monthlyRentRoll,
                'ytd_collected'       => (float) $ytdCollected,
                'this_month_collected'=> (float) $thisMonthCollected,
                'outstanding'         => (float) $outstanding,
            ],
            'payments'   => $payments,
            'trend'      => $trend,
        ]);
    }
}
