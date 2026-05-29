<?php

namespace App\Http\Controllers\Agency;

use App\Http\Controllers\Agency\Concerns\ResolvesAgency;
use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\Inquiry;
use App\Models\Listing;
use App\Services\InquiryService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ListingsAllocationController extends Controller
{
    use ResolvesAgency;

    public function index(Request $request): Response
    {
        $agency = $this->resolveAgency($request);

        $listings = Listing::query()
            ->where('owner_type', Agency::class)
            ->where('owner_id', $agency->id)
            ->whereNull('deleted_at')
            ->with('agent:id,name')
            ->withCount([
                'inquiries as inquiries_total',
                'inquiries as viewings_total' => fn ($q) => $q->where('status', 'viewing'),
                'inquiries as offers_total' => fn ($q) => $q->where('status', 'offer'),
            ])
            ->orderBy('status')
            ->orderByDesc('created_at')
            ->get();

        $activeAgents = $agency->agents()
            ->wherePivot('status', 'active')
            ->select('users.id', 'users.name')
            ->orderBy('name')
            ->get();

        $splitByAgent = AgencyAgent::query()
            ->where('agency_id', $agency->id)
            ->pluck('commission_split_percent', 'user_id');

        $cards = $listings->map(function (Listing $l) use ($splitByAgent) {
            $agentSplit = $l->agent_id ? (float) ($splitByAgent[$l->agent_id] ?? 70) : null;

            return [
                'id' => $l->id,
                'slug' => $l->slug,
                'title' => $l->title,
                'suburb' => $l->suburb,
                'city' => $l->city,
                'listing_type' => $l->listing_type,
                'primary_image' => $l->primary_image,
                'price_label' => $this->priceLabel($l),
                'agent' => $l->agent ? [
                    'id' => $l->agent->id,
                    'name' => $l->agent->name,
                    'initials' => $this->initials($l->agent->name),
                    'split' => $agentSplit,
                ] : null,
                'stats' => [
                    'inquiries' => (int) $l->inquiries_total,
                    'viewings' => (int) $l->viewings_total,
                    'offers' => (int) $l->offers_total,
                ],
            ];
        });

        // Round-robin "next up" agent
        $nextUp = $this->resolveNextUp($agency);

        // Recent leads queue (most recent 8 across this agency)
        $agentIds = $agency->agents()->pluck('users.id')->all();
        $leadQueue = Inquiry::query()
            ->whereIn('assigned_to', $agentIds)
            ->with(['listing:id,title,slug', 'assignee:id,name'])
            ->latest()
            ->take(8)
            ->get()
            ->map(fn ($inq) => [
                'id' => $inq->id,
                'visitor_name' => $inq->name,
                'listing_title' => $inq->listing?->title,
                'source' => $inq->source,
                'agent' => [
                    'id' => $inq->assignee?->id,
                    'name' => $inq->assignee?->name,
                    'initials' => $this->initials((string) $inq->assignee?->name),
                ],
                'allocation_method' => $inq->allocation_method,
                'status' => $inq->status,
                'created_at' => $inq->created_at?->diffForHumans(),
            ]);

        return Inertia::render('Agency/ListingsAllocation', [
            'agency' => ['id' => $agency->id, 'name' => $agency->name],
            'cards' => $cards,
            'agents' => $activeAgents,
            'next_up' => $nextUp ? ['id' => $nextUp->id, 'name' => $nextUp->name] : null,
            'lead_queue' => $leadQueue,
            'totals' => [
                'listings' => $cards->count(),
                'unassigned' => $cards->whereNull('agent')->count(),
                'agents' => $activeAgents->count(),
            ],
        ]);
    }

    public function assignListing(Request $request, Listing $listing): RedirectResponse
    {
        $agency = $this->resolveAgency($request);
        abort_unless(
            $listing->owner_type === Agency::class && (int) $listing->owner_id === $agency->id,
            403,
            'Listing does not belong to your agency.'
        );

        $data = $request->validate([
            'agent_id' => ['nullable', 'integer'],
        ]);

        if (! empty($data['agent_id'])) {
            $pivot = AgencyAgent::where('agency_id', $agency->id)
                ->where('user_id', $data['agent_id'])
                ->first();
            abort_unless($pivot, 422, 'Selected user is not an agent of this agency.');
        }

        $listing->update(['agent_id' => $data['agent_id'] ?? null]);

        return back()->with('success', $data['agent_id']
            ? 'Listing reassigned.'
            : 'Listing unassigned. New leads will route via round-robin.');
    }

    public function autoAssignListing(Request $request, Listing $listing, InquiryService $service): RedirectResponse
    {
        $agency = $this->resolveAgency($request);
        abort_unless(
            $listing->owner_type === Agency::class && (int) $listing->owner_id === $agency->id,
            403,
        );

        $agent = $service->allocateRoundRobin($listing);
        if (! $agent) {
            return back()->with('error', 'No active agents available for allocation.');
        }
        $listing->update(['agent_id' => $agent->id]);

        return back()->with('success', "Listing auto-assigned to {$agent->name} (round-robin).");
    }

    public function reassignLead(Request $request, Inquiry $inquiry): RedirectResponse
    {
        $agency = $this->resolveAgency($request);
        $agentIds = $agency->agents()->pluck('users.id')->all();

        abort_unless(in_array($inquiry->assigned_to, $agentIds, true), 403);

        $data = $request->validate([
            'agent_id' => ['required', 'integer'],
        ]);

        abort_unless(in_array($data['agent_id'], $agentIds, true), 422, 'Agent not in this agency.');

        $inquiry->update([
            'assigned_to' => $data['agent_id'],
            'allocation_method' => 'manual',
            'allocated_at' => now(),
        ]);

        return back()->with('success', 'Lead reassigned.');
    }

    private function priceLabel(Listing $l): string
    {
        return match ($l->listing_type) {
            'for_sale' => 'R '.number_format((float) $l->sale_price, 0, '.', ',').' sale',
            'long_term_rent' => 'R '.number_format((float) $l->monthly_rent, 0, '.', ',').' / month',
            'short_term_stay' => 'R '.number_format((float) $l->short_stay_nightly_price, 0, '.', ',').' / night',
            default => '—',
        };
    }

    private function initials(string $name): string
    {
        return collect(explode(' ', $name))
            ->take(2)
            ->map(fn ($w) => mb_substr($w, 0, 1))
            ->implode('');
    }

    private function resolveNextUp(Agency $agency): ?\App\Models\User
    {
        $pivot = AgencyAgent::where('agency_id', $agency->id)
            ->where('status', 'active')
            ->orderBy('lead_allocation_position')
            ->orderBy('id')
            ->first();

        return $pivot ? \App\Models\User::find($pivot->user_id) : null;
    }
}
