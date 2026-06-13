<?php

namespace App\Http\Controllers\Agency;

use App\Http\Controllers\Agency\Concerns\ResolvesAgency;
use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\Inquiry;
use App\Services\CommissionService;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PipelineController extends Controller
{
    use ResolvesAgency;

    /** Map enum statuses → kanban columns (new+contacted collapse into "new"). */
    private const COLUMNS = [
        'new' => ['label' => 'New Lead', 'dot' => 'bg-ink-400', 'statuses' => ['new', 'contacted']],
        'qualified' => ['label' => 'Qualified', 'dot' => 'bg-sky-500', 'statuses' => ['qualified']],
        'viewing' => ['label' => 'Viewing', 'dot' => 'bg-brand-500', 'statuses' => ['viewing']],
        'offer' => ['label' => 'Offer', 'dot' => 'bg-warning', 'statuses' => ['offer']],
        'closed' => ['label' => 'Closed (MTD)', 'dot' => 'bg-success', 'statuses' => ['closed']],
        'registered' => ['label' => 'Registered', 'dot' => 'bg-violet-500', 'statuses' => ['registered']],
    ];

    public function index(Request $request): Response
    {
        $agency = $this->resolveAgency($request);

        $filters = $request->validate([
            'agent_id' => ['nullable', 'integer'],
            'deal_type' => ['nullable', 'in:all,sale,rental'],
        ]);

        $agentIds = $agency->agents()->pluck('users.id')->all();

        $query = Inquiry::query()
            ->whereIn('assigned_to', $agentIds)
            ->with([
                'listing:id,title,slug,listing_type,sale_price,monthly_rent,short_stay_nightly_price',
                'assignee:id,name',
            ]);

        if (! empty($filters['agent_id'])) {
            $query->where('assigned_to', $filters['agent_id']);
        }
        if (! empty($filters['deal_type']) && $filters['deal_type'] !== 'all') {
            $query->whereHas('listing', function ($q) use ($filters) {
                if ($filters['deal_type'] === 'sale') {
                    $q->where('listing_type', 'for_sale');
                } else {
                    $q->whereIn('listing_type', ['long_term_rent', 'short_term_stay']);
                }
            });
        }

        $monthStart = CarbonImmutable::now()->startOfMonth();

        $columns = [];
        $totalPipelineValue = 0.0;

        foreach (self::COLUMNS as $key => $cfg) {
            $colQuery = (clone $query)->whereIn('status', $cfg['statuses']);

            // Closed column is MTD only
            if ($key === 'closed') {
                $colQuery->whereDate('updated_at', '>=', $monthStart);
            }

            $rows = $colQuery->orderByDesc('updated_at')->take(8)->get();
            $count = (clone $colQuery)->count();

            $cards = $rows->map(fn ($inq) => $this->formatCard($inq));
            $colValue = (float) $cards->sum('deal_value');
            if ($key !== 'closed') {
                $totalPipelineValue += $colValue;
            }

            $columns[] = [
                'key' => $key,
                'label' => $cfg['label'],
                'dot' => $cfg['dot'],
                'count' => $count,
                'total_value' => $colValue,
                'cards' => $cards->values(),
            ];
        }

        $agentList = $agency->agents()
            ->select('users.id', 'users.name')
            ->orderBy('name')
            ->get();

        return Inertia::render('Agency/Pipeline', [
            'agency' => ['id' => $agency->id, 'name' => $agency->name],
            'columns' => $columns,
            'total_pipeline_value' => $totalPipelineValue,
            'agents' => $agentList,
            'filters' => [
                'agent_id' => $filters['agent_id'] ?? null,
                'deal_type' => $filters['deal_type'] ?? 'all',
            ],
        ]);
    }

    /**
     * POST /agency/pipeline/leads/{inquiry}/register
     * Agency-only: move a Closed-Won deal into Registered. This is the
     * authoritative commission trigger — the assigned agent's commission is
     * generated into the payout queue. The agent sees the deal advance to
     * Registered on their own pipeline.
     */
    public function register(Request $request, Inquiry $inquiry, CommissionService $commissions): RedirectResponse
    {
        $agency = $this->resolveAgency($request);

        // The lead must belong to one of this agency's agents.
        $agentIds = $agency->agents()->pluck('users.id')->all();
        abort_unless(
            in_array($inquiry->assigned_to, $agentIds, true),
            403,
            'You can only register deals belonging to your agency\'s agents.',
        );
        abort_unless(
            $inquiry->status === 'closed',
            422,
            'Only a Closed-Won deal can be registered.',
        );

        $inquiry->update(['status' => 'registered']);

        $commission = $commissions->recordForLead($inquiry->fresh('listing', 'assignee'));

        $msg = $commission
            ? 'Deal registered — the agent\'s commission is now in the payout queue.'
            : 'Deal registered. (No commission was generated — check the linked listing has a price.)';

        return back()->with('success', $msg);
    }

    private function formatCard(Inquiry $inq): array
    {
        $listing = $inq->listing;
        $dealValue = 0.0;
        if ($listing) {
            $dealValue = (float) match ($listing->listing_type) {
                'for_sale' => $listing->sale_price ?? 0,
                'long_term_rent' => ($listing->monthly_rent ?? 0) * 12,
                'short_term_stay' => ($listing->short_stay_nightly_price ?? 0) * 30,
                default => 0,
            };
        }

        $isHot = in_array($inq->status, ['qualified', 'offer'], true)
            && $dealValue >= 1_000_000;

        return [
            'id' => $inq->id,
            'visitor_name' => $inq->name,
            'listing_title' => $listing?->title,
            'listing_slug' => $listing?->slug,
            'listing_type' => $listing?->listing_type,
            'deal_value' => $dealValue,
            'agent' => [
                'id' => $inq->assignee?->id,
                'name' => $inq->assignee?->name,
                'initials' => collect(explode(' ', (string) $inq->assignee?->name))
                    ->take(2)
                    ->map(fn ($w) => mb_substr($w, 0, 1))
                    ->implode(''),
            ],
            'is_hot' => $isHot,
            'status' => $inq->status,
            'can_register' => $inq->status === 'closed',
        ];
    }
}
