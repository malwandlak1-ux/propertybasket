<?php

namespace App\Http\Controllers\Agent;

use App\Http\Controllers\Agent\Concerns\ResolvesAgent;
use App\Http\Controllers\Controller;
use App\Models\Commission;
use App\Models\Inquiry;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AnalyticsController extends Controller
{
    use ResolvesAgent;

    private const RANGES = [7, 30, 90];

    public function index(Request $request): Response|StreamedResponse
    {
        $user        = $request->user();
        $agentRecord = $this->resolveAgentRecord($request);
        $now         = CarbonImmutable::now();
        $monthStart  = $now->startOfMonth();

        $range = (int) $request->query('range', 30);
        if (! in_array($range, self::RANGES, true)) {
            $range = 30;
        }

        // Current window = last $range days incl. today; previous = the $range before it.
        $start     = $now->startOfDay()->subDays($range - 1);
        $prevStart = $start->subDays($range);
        $prevEnd   = $start->subSecond();

        $mine = fn () => Inquiry::where('assigned_to', $user->id);

        // ── Daily series (this period + previous) ─────────────────────────────
        $leadsNow  = $this->dailyCounts($mine(), 'created_at', $start, $now, $range);
        $leadsPrev = $this->dailyCounts($mine(), 'created_at', $prevStart, $prevEnd, $range);

        $viewNow   = $this->dailyCounts($mine()->whereNotNull('viewing_scheduled_at'), 'viewing_scheduled_at', $start, $now, $range);
        $viewPrev  = $this->dailyCounts($mine()->whereNotNull('viewing_scheduled_at'), 'viewing_scheduled_at', $prevStart, $prevEnd, $range);

        $closedNow  = $this->dailyCounts($mine()->where('status', 'closed'), 'updated_at', $start, $now, $range);
        $closedPrev = $this->dailyCounts($mine()->where('status', 'closed'), 'updated_at', $prevStart, $prevEnd, $range);

        $commissionQ = fn () => Commission::where('agent_id', $user->id)->whereIn('status', ['approved', 'paid']);
        $revNow  = $this->dailySums($commissionQ(), 'agent_net', $start, $now, $range);
        $revPrev = $this->dailySums($commissionQ(), 'agent_net', $prevStart, $prevEnd, $range);

        $labels = collect(range(0, $range - 1))
            ->map(fn ($i) => $start->addDays($i)->format($range > 7 ? 'M j' : 'D'))
            ->all();

        $kpi = fn (array $now, array $prev) => [
            'value' => array_sum($now),
            'prev'  => array_sum($prev),
            'delta' => $this->pctDelta(array_sum($now), array_sum($prev)),
            'spark' => $this->bucket($now, 14),
        ];

        if ($request->query('export') === 'csv') {
            return $this->csv($start, $leadsNow, $viewNow, $closedNow, $revNow, $range);
        }

        // ── Conversion funnel (lifetime) ─────────────────────────────────────
        $statusCounts = $mine()
            ->selectRaw("status, count(*) as total")
            ->groupBy('status')
            ->pluck('total', 'status');

        $newLeads   = ($statusCounts['new'] ?? 0) + ($statusCounts['contacted'] ?? 0);
        $qualified  = $statusCounts['qualified'] ?? 0;
        $viewing    = $statusCounts['viewing'] ?? 0;
        $offer      = $statusCounts['offer'] ?? 0;
        $closed     = $statusCounts['closed'] ?? 0;

        $funnelMax = max(1, $newLeads);

        $funnel = [
            ['label' => 'New Lead',  'count' => $newLeads,  'pct' => 100],
            ['label' => 'Qualified', 'count' => $qualified, 'pct' => round(($qualified / $funnelMax) * 100)],
            ['label' => 'Viewing',   'count' => $viewing,   'pct' => round(($viewing / $funnelMax) * 100)],
            ['label' => 'Offer',     'count' => $offer,     'pct' => round(($offer / $funnelMax) * 100)],
            ['label' => 'Closed',    'count' => $closed,    'pct' => round(($closed / $funnelMax) * 100)],
        ];

        // ── Lead sources (selected range) ────────────────────────────────────
        $rangeTotal = max(1, array_sum($leadsNow));
        $sources = $mine()
            ->where('created_at', '>=', $start)
            ->selectRaw("source, count(*) as total")
            ->groupBy('source')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($r) => [
                'source' => ucfirst(str_replace('_', ' ', $r->source ?? 'unknown')),
                'count'  => (int) $r->total,
                'pct'    => round(($r->total / $rangeTotal) * 100),
            ]);

        // ── Top listings by leads (selected range) ───────────────────────────
        $topListings = $mine()
            ->where('created_at', '>=', $start)
            ->whereNotNull('listing_id')
            ->selectRaw('listing_id, count(*) as total')
            ->groupBy('listing_id')
            ->orderByDesc('total')
            ->limit(5)
            ->with('listing:id,title,suburb,city')
            ->get()
            ->map(fn ($r) => [
                'label' => $r->listing?->title ?? 'Listing #' . $r->listing_id,
                'sub'   => trim(($r->listing?->suburb ?? '') . ($r->listing?->city ? ', ' . $r->listing->city : ''), ', '),
                'value' => (int) $r->total,
            ]);

        // ── Activity heatmap: lead touches per day, last 20 weeks (Mon→Sun) ──
        $heatStart = $now->startOfWeek()->subWeeks(19);
        $created = $this->dailyCounts($mine(), 'created_at', $heatStart, $now, 140);
        $touched = $this->dailyCounts($mine()->whereColumn('updated_at', '>', 'created_at'), 'updated_at', $heatStart, $now, 140);
        $heat = collect(range(0, 139))
            ->map(fn ($i) => $created[$i] + $touched[$i])
            ->chunk(7)
            ->map(fn ($w) => $w->values())
            ->values();

        // ── Win/loss trend (last 6 months) ────────────────────────────────────
        $trend = collect(range(5, 0))->map(function ($n) use ($mine, $now) {
            $m = $now->startOfMonth()->subMonths($n);
            return [
                'month'  => $m->format('M'),
                'won'    => $mine()->where('status', 'closed')
                    ->whereBetween('updated_at', [$m->startOfMonth(), $m->endOfMonth()])->count(),
                'lost'   => $mine()->where('status', 'lost')
                    ->whereBetween('updated_at', [$m->startOfMonth(), $m->endOfMonth()])->count(),
            ];
        })->values();

        $maxTrend = max(1, ...$trend->map(fn ($t) => $t['won'] + $t['lost'])->all());

        return Inertia::render('Agent/Analytics', [
            'agent'         => ['id' => $user->id, 'name' => $user->name, 'agency_name' => $agentRecord->agency->name],
            'range'         => $range,
            'labels'        => $labels,
            'series'        => ['leads' => $leadsNow, 'leads_prev' => $leadsPrev],
            'kpis'          => [
                'leads'    => $kpi($leadsNow, $leadsPrev),
                'viewings' => $kpi($viewNow, $viewPrev),
                'closed'   => $kpi($closedNow, $closedPrev),
                'revenue'  => $kpi($revNow, $revPrev),
            ],
            'funnel'        => $funnel,
            'lead_sources'  => $sources,
            'top_listings'  => $topListings,
            'heatmap'       => $heat,
            'mtd' => [
                'leads'   => $mine()->where('created_at', '>=', $monthStart)->count(),
                'viewing' => $mine()->where('status', 'viewing')->where('created_at', '>=', $monthStart)->count(),
                'closed'  => $mine()->where('status', 'closed')->where('updated_at', '>=', $monthStart)->count(),
                'revenue' => (float) $commissionQ()->where('created_at', '>=', $monthStart)->sum('agent_net'),
            ],
            'trend'         => $trend,
            'max_trend'     => $maxTrend,
            'overall' => [
                'total_leads' => $mine()->count(),
                'conversion'  => round(($closed / $funnelMax) * 100, 1),
            ],
        ]);
    }

    /**
     * Per-day row counts for [$from, $to], zero-filled to $days entries.
     * Bucketed in PHP (not DATE()) so it behaves identically on MySQL + SQLite.
     */
    private function dailyCounts($query, string $column, CarbonImmutable $from, CarbonImmutable $to, int $days): array
    {
        $out  = array_fill(0, $days, 0);
        $base = $from->startOfDay();
        $query->whereBetween($column, [$from, $to])->pluck($column)
            ->each(function ($ts) use (&$out, $base, $days) {
                $i = (int) $base->diffInDays(CarbonImmutable::parse($ts)->startOfDay());
                if ($i >= 0 && $i < $days) $out[$i]++;
            });
        return $out;
    }

    private function dailySums($query, string $sumColumn, CarbonImmutable $from, CarbonImmutable $to, int $days): array
    {
        $out  = array_fill(0, $days, 0.0);
        $base = $from->startOfDay();
        $query->whereBetween('created_at', [$from, $to])->get(['created_at', $sumColumn])
            ->each(function ($row) use (&$out, $base, $days, $sumColumn) {
                $i = (int) $base->diffInDays(CarbonImmutable::parse($row->created_at)->startOfDay());
                if ($i >= 0 && $i < $days) $out[$i] += (float) $row->{$sumColumn};
            });
        return array_map(fn ($v) => round($v, 2), $out);
    }

    /** Collapse a daily series into at most $n buckets for sparklines. */
    private function bucket(array $series, int $n): array
    {
        if (count($series) <= $n) return array_values($series);
        return (new Collection($series))->chunk((int) ceil(count($series) / $n))->map->sum()->values()->all();
    }

    private function pctDelta(float $now, float $prev): ?float
    {
        if ($prev <= 0) return $now > 0 ? 100.0 : null;
        return round((($now - $prev) / $prev) * 100, 1);
    }

    private function csv(CarbonImmutable $start, array $leads, array $views, array $closed, array $rev, int $range): StreamedResponse
    {
        $name = 'analytics-' . $range . 'd-' . $start->format('Ymd') . '.csv';
        return response()->streamDownload(function () use ($start, $leads, $views, $closed, $rev, $range) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['date', 'leads', 'viewings', 'deals_closed', 'commission_zar']);
            for ($i = 0; $i < $range; $i++) {
                fputcsv($out, [$start->addDays($i)->toDateString(), $leads[$i], $views[$i], $closed[$i], $rev[$i]]);
            }
            fclose($out);
        }, $name, ['Content-Type' => 'text/csv']);
    }
}
