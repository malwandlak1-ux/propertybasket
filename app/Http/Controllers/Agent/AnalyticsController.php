<?php

namespace App\Http\Controllers\Agent;

use App\Http\Controllers\Agent\Concerns\ResolvesAgent;
use App\Http\Controllers\Controller;
use App\Models\Commission;
use App\Models\Inquiry;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AnalyticsController extends Controller
{
    use ResolvesAgent;

    public function index(Request $request): Response
    {
        $user        = $request->user();
        $agentRecord = $this->resolveAgentRecord($request);
        $now         = CarbonImmutable::now();
        $monthStart  = $now->startOfMonth();

        // ── Conversion funnel ─────────────────────────────────────────────────
        $statusCounts = Inquiry::where('assigned_to', $user->id)
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
            ['label' => 'Qualified', 'count' => $qualified, 'pct' => $funnelMax > 0 ? round(($qualified / $funnelMax) * 100) : 0],
            ['label' => 'Viewing',   'count' => $viewing,   'pct' => $funnelMax > 0 ? round(($viewing / $funnelMax) * 100) : 0],
            ['label' => 'Offer',     'count' => $offer,     'pct' => $funnelMax > 0 ? round(($offer / $funnelMax) * 100) : 0],
            ['label' => 'Closed',    'count' => $closed,    'pct' => $funnelMax > 0 ? round(($closed / $funnelMax) * 100) : 0],
        ];

        // ── Lead sources ──────────────────────────────────────────────────────
        $sources = Inquiry::where('assigned_to', $user->id)
            ->selectRaw("source, count(*) as total")
            ->groupBy('source')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($r) => [
                'source' => ucfirst(str_replace('_', ' ', $r->source ?? 'unknown')),
                'count'  => $r->total,
                'pct'    => $funnelMax > 0 ? round(($r->total / Inquiry::where('assigned_to', $user->id)->count()) * 100) : 0,
            ]);

        // ── MTD performance ────────────────────────────────────────────────────
        $mtdLeads   = Inquiry::where('assigned_to', $user->id)->where('created_at', '>=', $monthStart)->count();
        $mtdViewing = Inquiry::where('assigned_to', $user->id)->where('status', 'viewing')->where('created_at', '>=', $monthStart)->count();
        $mtdClosed  = Inquiry::where('assigned_to', $user->id)->where('status', 'closed')->where('updated_at', '>=', $monthStart)->count();
        $mtdRevenue = (float) Commission::where('agent_id', $user->id)
            ->whereIn('status', ['approved', 'paid'])
            ->where('created_at', '>=', $monthStart)
            ->sum('agent_net');

        // ── Win/loss trend (last 6 months) ────────────────────────────────────
        $trend = collect(range(5, 0))->map(function ($n) use ($user, $now) {
            $m = $now->startOfMonth()->subMonths($n);
            return [
                'month'  => $m->format('M'),
                'won'    => Inquiry::where('assigned_to', $user->id)->where('status', 'closed')
                    ->whereBetween('updated_at', [$m->startOfMonth(), $m->endOfMonth()])->count(),
                'lost'   => Inquiry::where('assigned_to', $user->id)->where('status', 'lost')
                    ->whereBetween('updated_at', [$m->startOfMonth(), $m->endOfMonth()])->count(),
            ];
        })->values();

        $maxTrend = max(1, ...$trend->map(fn ($t) => $t['won'] + $t['lost'])->all());

        return Inertia::render('Agent/Analytics', [
            'agent'         => ['id' => $user->id, 'name' => $user->name, 'agency_name' => $agentRecord->agency->name],
            'funnel'        => $funnel,
            'lead_sources'  => $sources,
            'mtd' => [
                'leads'   => $mtdLeads,
                'viewing' => $mtdViewing,
                'closed'  => $mtdClosed,
                'revenue' => $mtdRevenue,
            ],
            'trend'         => $trend,
            'max_trend'     => $maxTrend,
            'overall' => [
                'total_leads' => Inquiry::where('assigned_to', $user->id)->count(),
                'conversion'  => $funnelMax > 0 ? round(($closed / $funnelMax) * 100, 1) : 0.0,
            ],
        ]);
    }
}
