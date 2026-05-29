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

class ViewingsController extends Controller
{
    use ResolvesAgent;

    private const VIEWS = ['day', 'week', 'month'];

    public function index(Request $request): Response
    {
        $user        = $request->user();
        $agentRecord = $this->resolveAgentRecord($request);

        $view = in_array($request->query('view'), self::VIEWS, true)
            ? $request->query('view')
            : 'week';

        $cursor = $this->parseCursor($request->query('cursor'));
        [$periodStart, $periodEnd] = $this->periodRange($view, $cursor);

        // All viewings in the displayed period
        $viewings = Inquiry::where('assigned_to', $user->id)
            ->whereNotNull('viewing_scheduled_at')
            ->whereBetween('viewing_scheduled_at', [$periodStart, $periodEnd])
            ->with('listing:id,title,suburb,city')
            ->orderBy('viewing_scheduled_at')
            ->get()
            ->map(function ($inq) use ($periodStart) {
                $at = CarbonImmutable::parse($inq->viewing_scheduled_at);
                return [
                    'id'         => $inq->id,
                    'name'       => $inq->name,
                    'initials'   => collect(explode(' ', $inq->name))->take(2)->map(fn ($w) => mb_substr($w, 0, 1))->implode(''),
                    'date'       => $at->format('Y-m-d'),
                    'day_index'  => (int) $at->format('N') - 1, // 0=Mon … 6=Sun
                    'day_offset' => $periodStart->startOfDay()->diffInDays($at->startOfDay(), false),
                    'time'       => $at->format('H:i'),
                    'hour'       => (int) $at->format('G'),
                    'minute'     => (int) $at->format('i'),
                    'listing'    => $inq->listing?->title ?? '—',
                    'status'     => $inq->status,
                    'type'       => 'viewing',
                ];
            });

        // Day cells the calendar needs for the current view
        $days = $this->buildDays($view, $cursor, $periodStart, $periodEnd);

        // Upcoming (next 14 days beyond the period)
        $upcoming = Inquiry::where('assigned_to', $user->id)
            ->whereNotNull('viewing_scheduled_at')
            ->where('viewing_scheduled_at', '>', $periodEnd)
            ->where('viewing_scheduled_at', '<=', $periodEnd->addDays(14))
            ->with('listing:id,title')
            ->orderBy('viewing_scheduled_at')
            ->take(5)
            ->get()
            ->map(fn ($inq) => [
                'id'      => $inq->id,
                'name'    => $inq->name,
                'time'    => $inq->viewing_scheduled_at?->format('D d M · H:i'),
                'listing' => $inq->listing?->title ?? '—',
            ]);

        // Listings the agent can schedule a viewing against
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
            ->get(['id', 'title', 'listing_type', 'suburb'])
            ->map(fn ($l) => [
                'id'    => $l->id,
                'label' => $l->title . ($l->suburb ? " · {$l->suburb}" : ''),
                'type'  => $l->listing_type,
            ]);

        return Inertia::render('Agent/Viewings', [
            'agent'           => ['id' => $user->id, 'name' => $user->name, 'agency_name' => $agentRecord->agency->name],
            'view'            => $view,
            'cursor'          => $cursor->format('Y-m-d'),
            'period_label'    => $this->periodLabel($view, $cursor, $periodStart, $periodEnd),
            'period_start'    => $periodStart->format('Y-m-d'),
            'period_end'      => $periodEnd->format('Y-m-d'),
            'prev_cursor'     => $this->shiftCursor($view, $cursor, -1)->format('Y-m-d'),
            'next_cursor'     => $this->shiftCursor($view, $cursor, +1)->format('Y-m-d'),
            'today_cursor'    => CarbonImmutable::today()->format('Y-m-d'),
            'days'            => $days,
            'viewings'        => $viewings,
            'upcoming'        => $upcoming,
            'listings'        => $listings,
            'total_in_period' => $viewings->count(),
        ]);
    }

    /**
     * POST /agent/viewings — schedule a new viewing. Creates an Inquiry with
     * status=viewing + viewing_scheduled_at set. Same row the agency dashboard
     * reads, so it propagates across views.
     */
    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();
        $this->resolveAgentRecord($request);

        $data = $request->validate([
            'listing_id'   => ['required', 'integer', 'exists:listings,id'],
            'name'         => ['required', 'string', 'max:120'],
            'email'        => ['required', 'email', 'max:180'],
            'phone'        => ['nullable', 'string', 'max:30'],
            'scheduled_at' => ['required', 'date', 'after_or_equal:' . CarbonImmutable::now()->startOfDay()->toDateString()],
            'message'      => ['nullable', 'string', 'max:2000'],
            'view'         => ['nullable', Rule::in(self::VIEWS)],
            'cursor'       => ['nullable', 'date'],
        ]);

        $scheduledAt = CarbonImmutable::parse($data['scheduled_at']);

        Inquiry::create([
            'listing_id'           => $data['listing_id'],
            'name'                 => $data['name'],
            'email'                => $data['email'],
            'phone'                => $data['phone'] ?? null,
            'message'              => $data['message'] ?? null,
            'assigned_to'          => $user->id,
            'source'               => 'agent_manual',
            'status'               => 'viewing',
            'allocated_at'         => now(),
            'allocation_method'    => 'manual',
            'viewing_scheduled_at' => $scheduledAt,
        ]);

        Listing::where('id', $data['listing_id'])->increment('inquiries_count');

        // Land the user back on the calendar with the cursor pointed at the
        // scheduled day so they can see the new pin.
        $view = in_array($data['view'] ?? null, self::VIEWS, true) ? $data['view'] : 'week';

        return redirect()
            ->route('agent.viewings.index', [
                'view'   => $view,
                'cursor' => $scheduledAt->format('Y-m-d'),
            ])
            ->with('success', "Viewing scheduled with {$data['name']} on {$scheduledAt->format('D d M · H:i')}.");
    }

    private function parseCursor(?string $raw): CarbonImmutable
    {
        if ($raw) {
            try {
                return CarbonImmutable::parse($raw)->startOfDay();
            } catch (\Throwable) {
                // fall through
            }
        }
        return CarbonImmutable::today();
    }

    /** @return array{0: CarbonImmutable, 1: CarbonImmutable} */
    private function periodRange(string $view, CarbonImmutable $cursor): array
    {
        return match ($view) {
            'day'   => [$cursor->startOfDay(), $cursor->endOfDay()],
            'month' => [
                // 6-week grid starting Monday — month view also shows leading/trailing days.
                $cursor->startOfMonth()->startOfWeek(),
                $cursor->startOfMonth()->startOfWeek()->addDays(41)->endOfDay(),
            ],
            default => [$cursor->startOfWeek(), $cursor->endOfWeek()],
        };
    }

    private function shiftCursor(string $view, CarbonImmutable $cursor, int $direction): CarbonImmutable
    {
        return match ($view) {
            'day'   => $cursor->addDays($direction),
            'month' => $cursor->startOfMonth()->addMonths($direction),
            default => $cursor->addWeeks($direction),
        };
    }

    private function periodLabel(string $view, CarbonImmutable $cursor, CarbonImmutable $start, CarbonImmutable $end): string
    {
        return match ($view) {
            'day'   => $cursor->format('l, j F Y'),
            'month' => $cursor->format('F Y'),
            default => $start->format('M') === $end->format('M')
                ? $start->format('j') . '–' . $end->format('j F Y')
                : $start->format('j M') . ' – ' . $end->format('j M Y'),
        };
    }

    /**
     * @return array<int, array{label: string, weekday: string, date: int, iso: string, is_today: bool, in_period: bool}>
     */
    private function buildDays(string $view, CarbonImmutable $cursor, CarbonImmutable $start, CarbonImmutable $end): array
    {
        $today = CarbonImmutable::today();

        if ($view === 'day') {
            return [[
                'label'      => $cursor->format('D'),
                'weekday'    => $cursor->format('l'),
                'date'       => (int) $cursor->format('j'),
                'iso'        => $cursor->format('Y-m-d'),
                'is_today'   => $cursor->isSameDay($today),
                'in_period'  => true,
            ]];
        }

        $days = [];
        $totalDays = $view === 'month' ? 42 : 7;
        $monthRef  = $cursor->month;

        for ($i = 0; $i < $totalDays; $i++) {
            $d = $start->addDays($i);
            $days[] = [
                'label'     => $d->format('D'),
                'weekday'   => $d->format('l'),
                'date'      => (int) $d->format('j'),
                'iso'       => $d->format('Y-m-d'),
                'is_today'  => $d->isSameDay($today),
                'in_period' => $view === 'month' ? ($d->month === $monthRef) : true,
            ];
        }

        return $days;
    }
}
