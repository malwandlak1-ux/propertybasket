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

class CommissionController extends Controller
{
    use ResolvesAgent;

    public function index(Request $request): Response
    {
        $user        = $request->user();
        $agentRecord = $this->resolveAgentRecord($request);
        $now         = CarbonImmutable::now();
        $yearStart   = $now->startOfYear();

        // ── Headline stats ─────────────────────────────────────────────────────
        $ytdEarned = (float) Commission::where('agent_id', $user->id)
            ->whereDate('created_at', '>=', $yearStart)
            ->whereIn('status', ['approved', 'paid'])
            ->sum('agent_net');

        $annualTarget = 600_000.0; // Could come from agency settings later
        $targetPct    = $annualTarget > 0 ? min(100, round(($ytdEarned / $annualTarget) * 100)) : 0;

        // Pipeline value (approved commissions not yet paid)
        $pipelineValue = (float) Commission::where('agent_id', $user->id)
            ->whereIn('status', ['pending', 'approved'])
            ->sum('agent_net');

        // Pending payout (approved, not paid)
        $pendingPayout = (float) Commission::where('agent_id', $user->id)
            ->where('status', 'approved')
            ->sum('agent_net');

        // ── Monthly bar chart (12 months YTD or last 12) ──────────────────────
        $monthlyChart = collect(range(11, 0))->map(function ($n) use ($user, $now) {
            $m = $now->startOfMonth()->subMonths($n);
            $earned = (float) Commission::where('agent_id', $user->id)
                ->whereIn('status', ['approved', 'paid'])
                ->whereBetween('created_at', [$m->startOfMonth(), $m->endOfMonth()])
                ->sum('agent_net');
            return [
                'month'   => $m->format('M'),
                'earned'  => $earned,
                'target'  => 50_000.0, // monthly target stub
                'is_current' => $n === 0,
                'is_future'  => false,
            ];
        })->values();

        $maxBar = max(1, ...$monthlyChart->pluck('earned')->all(), ...$monthlyChart->pluck('target')->all());

        // ── Ledger (all commissions, newest first) ────────────────────────────
        $ledger = Commission::where('agent_id', $user->id)
            ->with('listing:id,title,listing_type')
            ->orderByDesc('created_at')
            ->take(20)
            ->get()
            ->map(fn ($c) => [
                'id'          => $c->id,
                'date'        => $c->created_at?->format('d M Y'),
                'description' => $c->listing?->title ?? 'Deal',
                'type_label'  => ucfirst($c->deal_type ?? '—'),
                'gross'       => (float) $c->gross_commission,
                'split_pct'   => (float) $c->agent_split_percent,
                'agent_net'   => (float) $c->agent_net,
                'status'      => $c->status,
                'blocked_reason' => $c->blocked_reason,
                'paid_at'     => $c->paid_at?->format('d M Y'),
            ]);

        // ── Next payout date (agency payout_day setting) ──────────────────────
        $payoutDay     = $agentRecord->agency->payout_day ?? 25;
        $nextPayoutDate = $now->day <= $payoutDay
            ? $now->setDay($payoutDay)
            : $now->addMonth()->setDay($payoutDay);

        return Inertia::render('Agent/Commission', [
            'agent' => [
                'id'          => $user->id,
                'name'        => $user->name,
                'agency_name' => $agentRecord->agency->name,
                'split_pct'   => (float) $agentRecord->commission_split_percent,
            ],
            'stats' => [
                'ytd_earned'     => $ytdEarned,
                'annual_target'  => $annualTarget,
                'target_pct'     => $targetPct,
                'pipeline_value' => $pipelineValue,
                'pending_payout' => $pendingPayout,
                'next_payout'    => $nextPayoutDate->format('d M Y'),
            ],
            'monthly_chart' => $monthlyChart,
            'max_bar'       => $maxBar,
            'ledger'        => $ledger,
        ]);
    }
}
