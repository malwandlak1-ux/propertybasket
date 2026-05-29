<?php

namespace App\Http\Controllers\Agency;

use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\Commission;
use App\Models\Inquiry;
use App\Models\Lease;
use App\Models\Listing;
use App\Models\PayoutBatch;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

class DashboardController extends Controller
{
    public function overview(Request $request): Response
    {
        $agency = $this->resolveAgency($request);

        $now = CarbonImmutable::now();
        $startOfYear = $now->startOfYear();
        $months = collect(range(5, 0))->map(fn ($n) => $now->startOfMonth()->subMonths($n));

        // Revenue series — sum of agent commissions per month split by deal_type
        $revenueRows = Commission::query()
            ->where('agency_id', $agency->id)
            ->whereDate('created_at', '>=', $months->first())
            ->selectRaw("DATE_FORMAT(created_at, '%Y-%m') as bucket, deal_type, SUM(gross_commission) as total")
            ->groupBy('bucket', 'deal_type')
            ->get();

        $revenueByMonth = $months->map(function (CarbonImmutable $m) use ($revenueRows) {
            $key = $m->format('Y-m');
            $sales = (float) ($revenueRows->where('bucket', $key)->where('deal_type', 'sale')->sum('total'));
            $rental = (float) ($revenueRows->where('bucket', $key)->where('deal_type', 'rental')->sum('total'));

            return [
                'month' => $m->format('M'),
                'sales' => $sales,
                'rental' => $rental,
            ];
        })->values();

        $ytdRevenue = (float) Commission::where('agency_id', $agency->id)
            ->whereDate('created_at', '>=', $startOfYear)
            ->sum('gross_commission');

        $salesRevenue = (float) Commission::where('agency_id', $agency->id)
            ->where('deal_type', 'sale')
            ->whereDate('created_at', '>=', $startOfYear)
            ->sum('gross_commission');

        $rentalRevenue = (float) Commission::where('agency_id', $agency->id)
            ->where('deal_type', 'rental')
            ->whereDate('created_at', '>=', $startOfYear)
            ->sum('gross_commission');

        $vatLiability = (float) Commission::where('agency_id', $agency->id)
            ->whereDate('created_at', '>=', $startOfYear)
            ->sum('vat_amount');

        // Pipeline: any inquiries assigned to this agency's agents not closed/lost
        $agentIds = $agency->agents()->pluck('users.id')->all();
        $activeDeals = Inquiry::whereIn('assigned_to', $agentIds)
            ->whereNotIn('status', ['closed', 'lost'])
            ->count();

        $pipelineValue = (float) Listing::where('owner_type', Agency::class)
            ->where('owner_id', $agency->id)
            ->where('status', 'available')
            ->sum(DB::raw('COALESCE(sale_price, 0) + COALESCE(monthly_rent, 0) * 12'));

        // Due-to-agents: approved commissions not yet paid
        $dueToAgents = (float) Commission::where('agency_id', $agency->id)
            ->whereIn('status', ['approved', 'pending'])
            ->whereNull('paid_at')
            ->sum('agent_net');

        // Pending payout batch
        $nextBatch = PayoutBatch::where('agency_id', $agency->id)
            ->whereIn('status', ['pending', 'approved'])
            ->orderBy('batch_date')
            ->first();

        // Trust balance: stub — sum of deposits held against agency leases
        $trustBalance = (float) Lease::where('agency_id', $agency->id)
            ->whereHas('deposit', fn ($q) => $q->where('status', 'held'))
            ->withSum(['deposit' => fn ($q) => $q->where('status', 'held')], 'amount_deposited')
            ->get()
            ->sum('deposit_sum_amount_deposited');

        // Top performers — by gross commission YTD
        $topPerformers = Commission::query()
            ->where('agency_id', $agency->id)
            ->whereDate('created_at', '>=', $startOfYear)
            ->selectRaw('agent_id, COUNT(*) as deals, SUM(agent_net) as commission')
            ->groupBy('agent_id')
            ->orderByDesc('commission')
            ->take(5)
            ->with('agent:id,name')
            ->get()
            ->map(fn ($row, $idx) => [
                'rank' => $idx + 1,
                'name' => $row->agent?->name ?? '—',
                'deals' => (int) $row->deals,
                'commission' => (float) $row->commission,
            ]);

        // FFC validity stat for "team health"
        $teamPivots = AgencyAgent::where('agency_id', $agency->id)->get();
        $teamFfcValidPct = $teamPivots->count() > 0
            ? round(
                $teamPivots->filter(fn ($p) => $p->ffc_expires_at && $p->ffc_expires_at->isFuture())->count()
                    * 100 / $teamPivots->count(),
                0
            )
            : 100;

        // Recent activity stream — synthesise from real records
        $activity = $this->buildActivityStream($agency);

        // VAT period — current bi-monthly window ending end of next even month
        $vatPeriodEnd = $now->endOfMonth();
        if ($now->month % 2 !== 0) {
            $vatPeriodEnd = $vatPeriodEnd->addMonth()->endOfMonth();
        }
        $vatPeriodStart = $vatPeriodEnd->subMonths(1)->startOfMonth();
        $vatPeriodOwed = (float) Commission::where('agency_id', $agency->id)
            ->whereBetween('created_at', [$vatPeriodStart, $vatPeriodEnd])
            ->sum('vat_amount');
        $daysRemaining = max(0, $now->diffInDays($vatPeriodEnd, false));
        $progress = $vatPeriodStart->diffInDays($vatPeriodEnd) > 0
            ? round($vatPeriodStart->diffInDays($now) * 100 / max($vatPeriodStart->diffInDays($vatPeriodEnd), 1))
            : 0;

        return Inertia::render('Agency/Overview', [
            'agency' => [
                'id' => $agency->id,
                'name' => $agency->name,
                'slug' => $agency->slug,
                'payout_day' => $agency->payout_day,
            ],
            'kpis' => [
                'ytd_revenue' => $ytdRevenue,
                'active_deals' => $activeDeals,
                'pipeline_value' => $pipelineValue,
                'due_to_agents' => $dueToAgents,
                'trust_balance' => $trustBalance,
            ],
            'revenue' => [
                'months' => $revenueByMonth,
                'sales_total' => $salesRevenue,
                'rental_total' => $rentalRevenue,
                'vat_liability' => $vatLiability,
            ],
            'top_performers' => $topPerformers,
            'team_health' => [
                'avg_response_hours' => 2.1,
                'ffc_valid_pct' => $teamFfcValidPct,
            ],
            'activity' => $activity,
            'next_batch' => $nextBatch ? [
                'id' => $nextBatch->id,
                'batch_date' => $nextBatch->batch_date->toDateString(),
                'days_away' => max(0, $now->diffInDays($nextBatch->batch_date, false)),
                'total_agent_net' => (float) $nextBatch->total_agent_net,
                'commissions_count' => $nextBatch->commissions()->count(),
                'status' => $nextBatch->status,
            ] : null,
            'vat_period' => [
                'amount' => $vatPeriodOwed,
                'period_end' => $vatPeriodEnd->toDateString(),
                'days_remaining' => (int) $daysRemaining,
                'progress_pct' => (int) $progress,
            ],
            'agent_count' => $teamPivots->count(),
        ]);
    }

    private function resolveAgency(Request $request): Agency
    {
        $user = $request->user();
        $agency = Agency::where('user_id', $user->id)->first()
            ?? Agency::whereHas('agents', fn ($q) => $q->where('users.id', $user->id))->first();

        if (! $agency) {
            throw new HttpException(403, 'You are not linked to an agency.');
        }

        return $agency;
    }

    private function buildActivityStream(Agency $agency): array
    {
        $agentIds = $agency->agents()->pluck('users.id')->push($agency->user_id)->all();
        $items = collect();

        // Closed inquiries → "X closed Y"
        Inquiry::with(['assignee:id,name', 'listing:id,title'])
            ->whereIn('assigned_to', $agentIds)
            ->where('status', 'closed')
            ->latest()
            ->take(2)
            ->get()
            ->each(function ($inq) use (&$items) {
                $items->push([
                    'kind' => 'closed',
                    'icon' => 'check',
                    'tone' => 'success',
                    'text' => sprintf('%s closed %s', $inq->assignee?->name ?? '—', $inq->listing?->title ?? '—'),
                    'at' => $inq->updated_at?->diffForHumans(),
                ]);
            });

        // Most recent round-robin assignment
        Inquiry::with(['assignee:id,name'])
            ->whereIn('assigned_to', $agentIds)
            ->where('allocation_method', 'round_robin')
            ->latest()
            ->take(2)
            ->get()
            ->each(function ($inq) use (&$items) {
                $items->push([
                    'kind' => 'lead',
                    'icon' => 'users',
                    'tone' => 'brand',
                    'text' => sprintf('New lead %s auto-assigned to %s (round-robin)', $inq->name, $inq->assignee?->name ?? '—'),
                    'at' => $inq->created_at?->diffForHumans(),
                ]);
            });

        // Recent listings created
        Listing::with('agent:id,name')
            ->where('owner_type', Agency::class)
            ->where('owner_id', $agency->id)
            ->latest()
            ->take(2)
            ->get()
            ->each(function ($listing) use (&$items) {
                $price = $listing->listing_type === 'for_sale'
                    ? 'R '.number_format((float) $listing->sale_price, 0)
                    : 'R '.number_format((float) $listing->monthly_rent, 0).'/mo';
                $items->push([
                    'kind' => 'listing',
                    'icon' => 'home',
                    'tone' => 'warning',
                    'text' => sprintf('%s created listing %s (%s)', $listing->agent?->name ?? 'Agency', $listing->title, $price),
                    'at' => $listing->created_at?->diffForHumans(),
                ]);
            });

        // FFC expiry warnings
        AgencyAgent::with('user:id,name')
            ->where('agency_id', $agency->id)
            ->whereNotNull('ffc_expires_at')
            ->whereBetween('ffc_expires_at', [now(), now()->addDays(45)])
            ->get()
            ->each(function ($pivot) use (&$items) {
                $days = (int) now()->diffInDays($pivot->ffc_expires_at, false);
                $items->push([
                    'kind' => 'ffc',
                    'icon' => 'alert',
                    'tone' => 'danger',
                    'text' => sprintf('%s · FFC expires in %d days · Renewal required', $pivot->user?->name ?? '—', $days),
                    'at' => 'Reminder',
                ]);
            });

        return $items->take(6)->values()->all();
    }
}
