<?php

namespace App\Http\Controllers\Agent;

use App\Http\Controllers\Agent\Concerns\ResolvesAgent;
use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\Inquiry;
use App\Models\Listing;
use App\Support\PipelineCard;
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
        'registered'=> ['label' => 'Registered', 'dot' => 'bg-violet-500','statuses' => ['registered']],
        'disqualified' => ['label' => 'Disqualified', 'dot' => 'bg-danger', 'statuses' => ['disqualified']],
    ];

    /** Statuses an agent may set themselves (Registered is agency-only). */
    private const AGENT_STATUSES = ['new', 'contacted', 'qualified', 'viewing', 'offer', 'closed', 'lost', 'disqualified'];

    public function index(Request $request): Response
    {
        $user        = $request->user();
        $agentRecord = $this->resolveAgentRecord($request);
        $now         = CarbonImmutable::now();
        $monthStart  = $now->startOfMonth();

        $query = Inquiry::where('assigned_to', $user->id)->with(PipelineCard::LISTING_COLUMNS);

        $columns = [];
        $totalValue = 0.0;

        foreach (self::COLUMNS as $key => $cfg) {
            $colQuery = (clone $query)->whereIn('status', $cfg['statuses']);
            if ($key === 'closed') {
                $colQuery->whereDate('updated_at', '>=', $monthStart);
            }

            $count = (clone $colQuery)->count();
            $rows  = $colQuery->orderByDesc('updated_at')->take(10)->get();

            $cards = $rows->map(fn ($inq) => PipelineCard::from($inq));
            $colValue = (float) $cards->sum('deal_value');

            if (! in_array($key, ['closed', 'registered', 'disqualified'], true)) {
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
            // A viewing date + time puts the lead on the viewings calendar.
            'viewing_date' => ['nullable', 'required_if:initial_stage,viewing', 'date_format:Y-m-d', 'required_with:viewing_time'],
            'viewing_time' => ['nullable', 'required_with:viewing_date', 'date_format:H:i'],
        ], [
            'viewing_date.required_if' => 'Pick the viewing date so it shows on your calendar.',
            'viewing_time.required_with' => 'Pick the viewing time.',
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
            'viewing_scheduled_at' => $this->viewingAt($data),
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

        // Registration is an agency-only step — agents can't move a deal into
        // or back out of Registered.
        abort_if(
            $inquiry->status === 'registered',
            422,
            'This deal has been registered by your agency and is locked.',
        );

        $data = $request->validate([
            'status' => ['required', Rule::in(self::AGENT_STATUSES)],
        ]);

        $inquiry->update(['status' => $data['status']]);

        return response()->noContent();
    }

    /**
     * PATCH /agent/pipeline/leads/{inquiry}/viewing — set (or clear) the viewing
     * date + time from the lead popup. Puts it on the viewings calendar and moves
     * an early-stage lead into Viewing.
     */
    public function scheduleViewing(Request $request, Inquiry $inquiry): RedirectResponse
    {
        abort_unless($inquiry->assigned_to === $request->user()->id, 403, 'You can only schedule your own leads.');

        $data = $request->validate([
            'viewing_date' => ['nullable', 'date_format:Y-m-d', 'required_with:viewing_time'],
            'viewing_time' => ['nullable', 'date_format:H:i', 'required_with:viewing_date'],
        ]);
        $at = $this->viewingAt($data);

        $inquiry->viewing_scheduled_at = $at;
        if ($at && in_array($inquiry->status, ['new', 'contacted', 'qualified'], true)) {
            $inquiry->status = 'viewing';
        }
        $inquiry->save();

        return back()->with('success', $at
            ? "Viewing with {$inquiry->name} set for " . $at->format('D d M') . ' at ' . $at->format('H:i') . ' — it’s on your calendar.'
            : "Viewing with {$inquiry->name} removed from your calendar.");
    }

    private function viewingAt(array $data): ?CarbonImmutable
    {
        if (empty($data['viewing_date']) || empty($data['viewing_time'])) {
            return null;
        }

        return CarbonImmutable::createFromFormat('Y-m-d H:i', "{$data['viewing_date']} {$data['viewing_time']}", config('app.timezone'));
    }
}
