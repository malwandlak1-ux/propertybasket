<?php

namespace App\Http\Controllers\Agency;

use App\Http\Controllers\Agency\Concerns\ResolvesAgency;
use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\LandlordPayout;
use App\Models\Lease;
use App\Models\Listing;
use App\Models\ManagedLandlord;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The agency "Landlords" tab — managed landlords (no login) whose rental
 * properties the agency manages. The agency captures contact + banking + a
 * landlord/agency/agent split per property; this drives the monthly landlord
 * payment batch. Rentals only.
 */
class LandlordsController extends Controller
{
    use ResolvesAgency;

    public function index(Request $request): Response
    {
        $agency = $this->resolveAgency($request);
        $monthStart = CarbonImmutable::now()->startOfMonth();

        $landlords = ManagedLandlord::where('agency_id', $agency->id)
            ->orderBy('name')
            ->get();

        // Linked rental properties for this agency, with their current lease + agent.
        $listings = Listing::where('owner_type', Agency::class)
            ->where('owner_id', $agency->id)
            ->where('listing_type', 'long_term_rent')
            ->whereNotNull('managed_landlord_id')
            ->with(['agent:id,name', 'leases' => fn ($q) => $q->orderByDesc('start_date')])
            ->get();

        // Which (listing, month) have already been paid this month?
        $paidThisMonth = LandlordPayout::where('agency_id', $agency->id)
            ->whereDate('period_month', $monthStart->toDateString())
            ->pluck('listing_id')
            ->all();

        $byLandlord = [];
        $totals = ['landlord_due' => 0.0, 'agency_due' => 0.0, 'agent_due' => 0.0, 'properties' => 0, 'payable' => 0.0];

        foreach ($listings as $listing) {
            $lease = $this->currentLease($listing);
            $rent = (float) ($lease?->monthly_rent ?? 0);
            $lp = (float) ($listing->landlord_split_percent ?? 0);
            $ap = (float) ($listing->agency_split_percent ?? 0);
            $gp = (float) ($listing->agent_split_percent ?? 0);

            $landlordDue = round($rent * $lp / 100, 2);
            $agencyDue = round($rent * $ap / 100, 2);
            $agentDue = round($rent - $landlordDue - $agencyDue, 2); // remainder avoids drift
            if ($agentDue < 0) {
                $agentDue = 0.0;
            }

            $paid = in_array($listing->id, $paidThisMonth, true);

            $prop = [
                'listing_id' => $listing->id,
                'title' => $listing->title,
                'suburb' => $listing->suburb,
                'rent' => $rent,
                'landlord_pct' => $lp,
                'agency_pct' => $ap,
                'agent_pct' => $gp,
                'agent_name' => $lease?->agent?->name ?? $listing->agent?->name,
                'has_current_lease' => (bool) $lease,
                'landlord_due' => $landlordDue,
                'agency_due' => $agencyDue,
                'agent_due' => $agentDue,
                'paid_this_month' => $paid,
            ];

            $byLandlord[$listing->managed_landlord_id][] = $prop;

            if ($lease && ! $paid) {
                $totals['landlord_due'] += $landlordDue;
                $totals['agency_due'] += $agencyDue;
                $totals['agent_due'] += $agentDue;
                $totals['payable'] += $landlordDue;
                $totals['properties']++;
            }
        }

        $landlordPayload = $landlords->map(function (ManagedLandlord $l) use ($byLandlord) {
            $props = $byLandlord[$l->id] ?? [];
            $acct = $l->bank_account_number;
            return [
                'id' => $l->id,
                'name' => $l->name,
                'email' => $l->email,
                'phone' => $l->phone,
                'has_banking' => $l->hasBankingDetails(),
                'bank_name' => $l->bank_name,
                'bank_account_holder' => $l->bank_account_holder,
                'bank_account_masked' => $acct ? '•••• ' . substr($acct, -4) : null,
                'bank_branch_code' => $l->bank_branch_code,
                'bank_account_type' => $l->bank_account_type,
                'properties' => $props,
                'month_landlord_due' => collect($props)->where('paid_this_month', false)->where('has_current_lease', true)->sum('landlord_due'),
            ];
        })->values();

        // Rental listings available to link (agency-owned, rental, not yet linked).
        $available = Listing::where('owner_type', Agency::class)
            ->where('owner_id', $agency->id)
            ->where('listing_type', 'long_term_rent')
            ->whereNull('managed_landlord_id')
            ->orderBy('title')
            ->get(['id', 'title', 'suburb', 'monthly_rent'])
            ->map(fn ($l) => [
                'id' => $l->id,
                'title' => $l->title,
                'suburb' => $l->suburb,
                'rent' => (float) $l->monthly_rent,
            ]);

        // 6-month rental performance (from recorded payouts).
        $history = [];
        for ($i = 5; $i >= 0; $i--) {
            $m = $monthStart->subMonths($i);
            $rows = LandlordPayout::where('agency_id', $agency->id)
                ->whereDate('period_month', $m->toDateString())
                ->get();
            $history[] = [
                'label' => $m->format('M'),
                'rent' => (float) $rows->sum('rent_amount'),
                'landlord' => (float) $rows->sum('landlord_amount'),
                'agency' => (float) $rows->sum('agency_amount'),
                'agent' => (float) $rows->sum('agent_amount'),
            ];
        }

        $recent = LandlordPayout::where('agency_id', $agency->id)
            ->with(['managedLandlord:id,name', 'listing:id,title'])
            ->orderByDesc('period_month')->orderByDesc('id')
            ->limit(20)->get()
            ->map(fn (LandlordPayout $p) => [
                'id' => $p->id,
                'landlord' => $p->managedLandlord?->name,
                'property' => $p->listing?->title,
                'month' => $p->period_month?->format('M Y'),
                'rent' => (float) $p->rent_amount,
                'landlord_amount' => (float) $p->landlord_amount,
                'agency_amount' => (float) $p->agency_amount,
                'agent_amount' => (float) $p->agent_amount,
                'status' => $p->status,
            ]);

        return Inertia::render('Agency/Landlords', [
            'agency' => ['id' => $agency->id, 'name' => $agency->name],
            'landlords' => $landlordPayload,
            'totals' => [
                'landlord_due' => round($totals['landlord_due'], 2),
                'agency_due' => round($totals['agency_due'], 2),
                'agent_due' => round($totals['agent_due'], 2),
                'properties' => $totals['properties'],
            ],
            'available_listings' => $available,
            'history' => $history,
            'recent_payouts' => $recent,
            'current_month' => $monthStart->format('F Y'),
        ]);
    }

    public function storeLandlord(Request $request): RedirectResponse
    {
        $agency = $this->resolveAgency($request);
        $data = $this->validateLandlord($request);
        $data['agency_id'] = $agency->id;
        ManagedLandlord::create($data);

        return back()->with('success', 'Landlord added.');
    }

    public function updateLandlord(Request $request, ManagedLandlord $managedLandlord): RedirectResponse
    {
        $agency = $this->resolveAgency($request);
        abort_unless($managedLandlord->agency_id === $agency->id, 403);
        $managedLandlord->update($this->validateLandlord($request));

        return back()->with('success', 'Landlord updated.');
    }

    public function destroyLandlord(Request $request, ManagedLandlord $managedLandlord): RedirectResponse
    {
        $agency = $this->resolveAgency($request);
        abort_unless($managedLandlord->agency_id === $agency->id, 403);
        // Unlink any properties, then soft-delete.
        Listing::where('managed_landlord_id', $managedLandlord->id)->update([
            'managed_landlord_id' => null,
            'landlord_split_percent' => null,
            'agency_split_percent' => null,
            'agent_split_percent' => null,
        ]);
        $managedLandlord->delete();

        return back()->with('success', 'Landlord removed.');
    }

    public function linkProperty(Request $request): RedirectResponse
    {
        $agency = $this->resolveAgency($request);
        $data = $request->validate([
            'listing_id' => ['required', 'integer'],
            'managed_landlord_id' => ['required', 'integer'],
            'landlord_split_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'agency_split_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'agent_split_percent' => ['required', 'numeric', 'min:0', 'max:100'],
        ]);

        $sum = $data['landlord_split_percent'] + $data['agency_split_percent'] + $data['agent_split_percent'];
        if (abs($sum - 100) > 0.01) {
            return back()->with('error', 'The landlord, agency and agent split must add up to 100%.');
        }

        $landlord = ManagedLandlord::where('agency_id', $agency->id)->findOrFail($data['managed_landlord_id']);
        $listing = Listing::where('owner_type', Agency::class)
            ->where('owner_id', $agency->id)
            ->where('listing_type', 'long_term_rent')
            ->findOrFail($data['listing_id']);

        $listing->update([
            'managed_landlord_id' => $landlord->id,
            'landlord_split_percent' => $data['landlord_split_percent'],
            'agency_split_percent' => $data['agency_split_percent'],
            'agent_split_percent' => $data['agent_split_percent'],
        ]);

        return back()->with('success', 'Property linked to landlord.');
    }

    public function unlinkProperty(Request $request, Listing $listing): RedirectResponse
    {
        $agency = $this->resolveAgency($request);
        abort_unless($listing->owner_type === Agency::class && (int) $listing->owner_id === $agency->id, 403);
        $listing->update([
            'managed_landlord_id' => null,
            'landlord_split_percent' => null,
            'agency_split_percent' => null,
            'agent_split_percent' => null,
        ]);

        return back()->with('success', 'Property unlinked.');
    }

    /**
     * Run the landlord payment batch for the current month — one payout per
     * linked rental property with a current lease, split per the captured
     * percentages. Idempotent: a property already paid this month is skipped.
     */
    public function runMonthlyPayout(Request $request): RedirectResponse
    {
        $agency = $this->resolveAgency($request);
        $monthStart = CarbonImmutable::now()->startOfMonth();

        $listings = Listing::where('owner_type', Agency::class)
            ->where('owner_id', $agency->id)
            ->where('listing_type', 'long_term_rent')
            ->whereNotNull('managed_landlord_id')
            ->with(['leases' => fn ($q) => $q->orderByDesc('start_date'), 'managedLandlord'])
            ->get();

        $created = 0;
        $pending = 0;

        DB::transaction(function () use ($listings, $agency, $monthStart, &$created, &$pending) {
            foreach ($listings as $listing) {
                $lease = $this->currentLease($listing);
                if (! $lease) {
                    continue; // no current tenant → no rent to split
                }

                $exists = LandlordPayout::where('listing_id', $listing->id)
                    ->whereDate('period_month', $monthStart->toDateString())
                    ->exists();
                if ($exists) {
                    continue;
                }

                $rent = (float) $lease->monthly_rent;
                $landlordDue = round($rent * (float) $listing->landlord_split_percent / 100, 2);
                $agencyDue = round($rent * (float) $listing->agency_split_percent / 100, 2);
                $agentDue = round($rent - $landlordDue - $agencyDue, 2);
                if ($agentDue < 0) {
                    $agentDue = 0.0;
                }

                $hasBank = $listing->managedLandlord?->hasBankingDetails() ?? false;

                LandlordPayout::create([
                    'agency_id' => $agency->id,
                    'managed_landlord_id' => $listing->managed_landlord_id,
                    'listing_id' => $listing->id,
                    'lease_id' => $lease->id,
                    'agent_id' => $lease->agent_id ?? $listing->agent_id,
                    'period_month' => $monthStart->toDateString(),
                    'rent_amount' => $rent,
                    'landlord_amount' => $landlordDue,
                    'agency_amount' => $agencyDue,
                    'agent_amount' => $agentDue,
                    'status' => $hasBank ? 'paid' : 'pending',
                    'payout_method' => $hasBank ? 'bank' : null,
                    'paid_at' => $hasBank ? now() : null,
                ]);

                $hasBank ? $created++ : $pending++;
            }
        });

        if ($created === 0 && $pending === 0) {
            return back()->with('error', 'Nothing to pay — no linked properties with a current lease this month (or all already paid).');
        }

        $msg = "Landlord batch run: {$created} paid";
        if ($pending > 0) {
            $msg .= ", {$pending} held (landlord has no banking details captured)";
        }

        return back()->with('success', $msg . '.');
    }

    /** The current lease for a listing: the latest one still in effect. */
    private function currentLease(Listing $listing): ?Lease
    {
        $today = CarbonImmutable::now()->startOfDay();
        foreach ($listing->leases as $lease) {
            $active = $lease->status === 'active';
            $inWindow = ($lease->end_date === null || $lease->end_date->gte($today))
                && ($lease->start_date === null || $lease->start_date->lte($today));
            if ($active || $inWindow) {
                return $lease;
            }
        }
        return null;
    }

    private function validateLandlord(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'email' => ['nullable', 'email', 'max:180'],
            'phone' => ['nullable', 'string', 'max:40'],
            'bank_name' => ['nullable', 'string', 'max:120'],
            'bank_account_holder' => ['nullable', 'string', 'max:160'],
            'bank_account_number' => ['nullable', 'string', 'max:40'],
            'bank_branch_code' => ['nullable', 'string', 'max:20'],
            'bank_account_type' => ['nullable', 'string', 'max:40'],
        ]);
    }
}
