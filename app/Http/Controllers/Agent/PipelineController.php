<?php

namespace App\Http\Controllers\Agent;

use App\Http\Controllers\Agent\Concerns\ResolvesAgent;
use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\Inquiry;
use App\Models\Listing;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PipelineController extends Controller
{
    use ResolvesAgent;

    private const COLUMNS = [
        'new'       => ['label' => 'New Lead',   'dot' => 'bg-ink-400',  'statuses' => ['new', 'contacted']],
        'qualified' => ['label' => 'Qualified',  'dot' => 'bg-sky-500',  'statuses' => ['qualified']],
        'viewing'   => ['label' => 'Viewing',    'dot' => 'bg-brand-500','statuses' => ['viewing']],
        'offer'     => ['label' => 'Offer',      'dot' => 'bg-warning',  'statuses' => ['offer']],
        'closed'    => ['label' => 'Closed Won', 'dot' => 'bg-success',  'statuses' => ['closed']],
    ];

    public function index(Request $request): Response
    {
        $user        = $request->user();
        $agentRecord = $this->resolveAgentRecord($request);
        $now         = CarbonImmutable::now();
        $monthStart  = $now->startOfMonth();

        $query = Inquiry::where('assigned_to', $user->id)
            ->with('listing:id,title,slug,listing_type,sale_price,monthly_rent,short_stay_nightly_price');

        $columns = [];
        $totalValue = 0.0;

        foreach (self::COLUMNS as $key => $cfg) {
            $colQuery = (clone $query)->whereIn('status', $cfg['statuses']);
            if ($key === 'closed') {
                $colQuery->whereDate('updated_at', '>=', $monthStart);
            }

            $count = (clone $colQuery)->count();
            $rows  = $colQuery->orderByDesc('updated_at')->take(10)->get();

            $cards = $rows->map(fn ($inq) => $this->card($inq));
            $colValue = (float) $cards->sum('deal_value');

            if ($key !== 'closed') {
                $totalValue += $colValue;
            }

            $columns[] = [
                'key'         => $key,
                'label'       => $cfg['label'],
                'dot'         => $cfg['dot'],
                'count'       => $count,
                'total_value' => $colValue,
                'cards'       => $cards->values(),
            ];
        }

        // Listings the agent can attach a new lead to — all listings owned by
        // their agency (plus any landlord listings they manage).
        $listings = Listing::query()
            ->where(function ($q) use ($agentRecord) {
                $q->where(function ($q2) use ($agentRecord) {
                    $q2->where('owner_type', Agency::class)
                       ->where('owner_id', $agentRecord->agency_id);
                })->orWhere('agent_id', $agentRecord->user_id);
            })
            ->whereIn('status', ['available', 'draft'])
            ->orderByDesc('created_at')
            ->limit(200)
            ->get(['id', 'title', 'listing_type', 'suburb', 'city'])
            ->map(fn ($l) => [
                'id'    => $l->id,
                'label' => $l->title . ($l->suburb ? " · {$l->suburb}" : ''),
                'type'  => $l->listing_type,
            ]);

        return Inertia::render('Agent/Pipeline', [
            'agent'        => ['id' => $user->id, 'name' => $user->name, 'agency_name' => $agentRecord->agency->name],
            'columns'      => $columns,
            'total_value'  => $totalValue,
            'listings'     => $listings,
        ]);
    }

    /**
     * POST /agent/pipeline/leads — create a new Inquiry assigned to this agent.
     * Used by the "+ New Lead" / "Add Deal" / column "+ Add deal" buttons.
     */
    public function storeLead(Request $request): RedirectResponse
    {
        $user = $request->user();
        $this->resolveAgentRecord($request);

        $data = $request->validate([
            'listing_id'   => ['required', 'integer', 'exists:listings,id'],
            'name'         => ['required', 'string', 'max:120'],
            'email'        => ['required', 'email', 'max:180'],
            'phone'        => ['nullable', 'string', 'max:30'],
            'message'      => ['nullable', 'string', 'max:2000'],
            'initial_stage'=> ['nullable', Rule::in(['new', 'contacted', 'qualified', 'viewing', 'offer'])],
        ]);

        Inquiry::create([
            'listing_id'        => $data['listing_id'],
            'name'              => $data['name'],
            'email'             => $data['email'],
            'phone'             => $data['phone'] ?? null,
            'message'           => $data['message'] ?? null,
            'assigned_to'       => $user->id,
            'source'            => 'agent_manual',
            'status'            => $data['initial_stage'] ?? 'new',
            'allocated_at'      => now(),
            'allocation_method' => 'manual',
        ]);

        // Bump the listing's inquiries counter to keep listings KPIs consistent.
        Listing::where('id', $data['listing_id'])->increment('inquiries_count');

        return redirect()
            ->route('agent.pipeline.index')
            ->with('success', "Lead {$data['name']} added to your pipeline.");
    }

    /**
     * PATCH /agent/pipeline/leads/{inquiry}/status
     * Drag-and-drop status change. Updates the inquiry's status enum; the agency
     * pipeline view queries the same `inquiries` table so its kanban + reports
     * auto-reflect on next page load. Returns 204 No Content for fire-and-forget UX.
     */
    public function updateLeadStatus(Request $request, Inquiry $inquiry): \Illuminate\Http\Response
    {
        $user = $request->user();

        abort_unless(
            $inquiry->assigned_to === $user->id,
            403,
            'You can only move your own leads.'
        );

        $data = $request->validate([
            'status' => ['required', Rule::in(['new', 'contacted', 'qualified', 'viewing', 'offer', 'closed', 'lost'])],
        ]);

        $inquiry->update(['status' => $data['status']]);

        return response()->noContent();
    }

    private function card(Inquiry $inq): array
    {
        $listing  = $inq->listing;
        $dv       = $listing ? (float) match ($listing->listing_type) {
            'for_sale'        => $listing->sale_price ?? 0,
            'long_term_rent'  => ($listing->monthly_rent ?? 0) * 12,
            'short_term_stay' => ($listing->short_stay_nightly_price ?? 0) * 30,
            default           => 0,
        } : 0.0;

        $isHot = in_array($inq->status, ['qualified', 'offer']) && $dv >= 1_000_000;

        return [
            'id'            => $inq->id,
            'visitor_name'  => $inq->name,
            'email'         => $inq->email,
            'phone'         => $inq->phone,
            'message'       => $inq->message,
            'listing_id'    => $listing?->id,
            'listing_title' => $listing?->title,
            'listing_type'  => $listing?->listing_type,
            'listing_slug'  => $listing?->slug,
            'deal_value'    => $dv,
            'is_hot'        => $isHot,
            'status'        => $inq->status,
            'source'        => $inq->source,
            'created_at'    => $inq->created_at?->format('d M Y \a\t H:i'),
            'age_label'     => $inq->updated_at?->diffForHumans() ?? '—',
            'viewing_at'    => $inq->viewing_scheduled_at?->format('D d M · H:i'),
        ];
    }
}
