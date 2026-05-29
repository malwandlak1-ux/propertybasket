<?php

namespace App\Http\Controllers\Landlord;

use App\Http\Controllers\Landlord\Concerns\ResolvesLandlord;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Inertia\Inertia;
use Inertia\Response;

class PropertiesController extends Controller
{
    use ResolvesLandlord;

    public function index(Request $request): Response
    {
        $landlord = $this->resolveLandlord($request);
        $now      = CarbonImmutable::now();
        $period   = $now->format('Y-m');

        $listings = $landlord->listings()
            ->with(['leases' => fn($q) => $q->whereIn('status', ['active', 'pending'])->with(['tenant', 'rentPayments'])])
            ->get();

        $maxSlots = 5;

        $properties = $listings->map(function ($listing) use ($now, $period) {
            $lease       = $listing->leases->first();
            $isOccupied  = $lease !== null;

            $payStatus = null;
            if ($isOccupied && $listing->listing_type === 'long_term_rent') {
                $cp = $lease->rentPayments->where('period_month', $period)->first();
                $payStatus = match (true) {
                    $cp === null                  => 'due',
                    $cp->paid_at !== null         => 'paid',
                    $now->gt($cp->due_date ?? $now) => 'overdue',
                    default                       => 'due',
                };
            }

            // Days until lease ends
            $daysToExpiry = $lease?->end_date ? $now->diffInDays($lease->end_date, false) : null;
            $expiryBadge  = match (true) {
                $daysToExpiry === null => null,
                $daysToExpiry <= 30   => 'expires_soon',
                $daysToExpiry <= 90   => 'expires_3mo',
                default               => null,
            };

            return [
                'id'             => $listing->id,
                'title'          => $listing->title,
                'suburb'         => $listing->suburb,
                'city'           => $listing->city,
                'bedrooms'       => $listing->bedrooms,
                'bathrooms'      => $listing->bathrooms,
                'area_sqm'       => $listing->area_sqm,
                'listing_type'   => $listing->listing_type,
                'monthly_rent'   => (float) ($listing->monthly_rent ?? 0),
                'nightly_price'  => (float) ($listing->short_stay_nightly_price ?? 0),
                'occupied'       => $isOccupied,
                'tenant_name'    => $lease?->tenant?->name,
                'tenant_initials'=> $lease?->tenant?->name
                    ? collect(explode(' ', $lease->tenant->name))->map(fn($s) => $s[0])->slice(0, 2)->implode('')
                    : null,
                'lease_end'      => $lease?->end_date?->format('M Y'),
                'lease_end_date' => $lease?->end_date?->toDateString(),
                'pay_status'     => $payStatus,
                'expiry_badge'   => $expiryBadge,
                'days_to_expiry' => $daysToExpiry,
                'color_class'    => $this->colorClass($listing->id),
                'primary_image'  => $listing->primary_image,
                'yield_pct'      => $this->estimatedYield($listing),
            ];
        })->values()->all();

        return Inertia::render('Landlord/Properties', [
            'landlord'   => ['id' => $landlord->id, 'name' => $request->user()->name],
            'properties' => $properties,
            'slots_used' => count($properties),
            'slots_max'  => $maxSlots,
        ]);
    }

    private function colorClass(int $id): string
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

    private function estimatedYield($listing): float|null
    {
        if ($listing->listing_type !== 'long_term_rent' || ! $listing->monthly_rent) {
            return null;
        }
        // Rough estimate: annual rent / (monthly_rent × 130) × 100
        // (assumes property value ≈ 130× monthly rent for Gauteng)
        $annualRent    = (float) $listing->monthly_rent * 12;
        $estimatedValue = (float) $listing->monthly_rent * 130;
        return round($annualRent / $estimatedValue * 100, 1);
    }
}
