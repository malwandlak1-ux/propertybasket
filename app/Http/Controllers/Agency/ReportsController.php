<?php

namespace App\Http\Controllers\Agency;

use App\Http\Controllers\Agency\Concerns\ResolvesAgency;
use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\Commission;
use App\Models\Lease;
use App\Models\RentPayment;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ReportsController extends Controller
{
    use ResolvesAgency;

    public function index(Request $request): Response
    {
        $agency = $this->resolveAgency($request);
        $now = CarbonImmutable::now();
        $yearStart = $now->startOfYear();

        // ----- Income Statement (YTD)
        $ytdCommissions = Commission::query()
            ->where('agency_id', $agency->id)
            ->whereDate('created_at', '>=', $yearStart)
            ->get();

        $gross = (float) $ytdCommissions->sum('gross_commission');
        $agentPaid = (float) $ytdCommissions->where('status', 'paid')->sum('agent_net');
        $vatLiability = (float) $ytdCommissions->sum('vat_amount');
        $netToAgency = (float) $ytdCommissions->sum('agency_amount');
        $netMargin = $gross > 0 ? round(($netToAgency / $gross) * 100, 1) : 0;

        // ----- Cash flow (last 6 months)
        $months = collect(range(5, 0))->map(fn ($n) => $now->startOfMonth()->subMonths($n));
        $cashflow = $months->map(function (CarbonImmutable $m) use ($agency) {
            $monthStart = $m->startOfMonth();
            $monthEnd = $m->endOfMonth();

            $inflow = (float) Commission::where('agency_id', $agency->id)
                ->whereBetween('created_at', [$monthStart, $monthEnd])
                ->sum('gross_commission');

            $outflow = (float) Commission::where('agency_id', $agency->id)
                ->where('status', 'paid')
                ->whereBetween('paid_at', [$monthStart, $monthEnd])
                ->sum('agent_net');

            return [
                'month' => $m->format('M'),
                'inflow' => $inflow,
                'outflow' => $outflow,
            ];
        });

        // ----- Trust account snapshot
        $depositsHeld = (float) Lease::query()
            ->where('agency_id', $agency->id)
            ->join('deposits', 'deposits.lease_id', '=', 'leases.id')
            ->where('deposits.status', 'held')
            ->sum(DB::raw('deposits.amount_deposited + deposits.accrued_interest'));

        $rentInTransit = (float) RentPayment::query()
            ->whereHas('lease', fn ($q) => $q->where('agency_id', $agency->id))
            ->where('status', 'pending')
            ->whereMonth('due_date', $now->month)
            ->whereYear('due_date', $now->year)
            ->sum('amount');

        $trustBalance = $depositsHeld + $rentInTransit;
        $trustAcctLast4 = $agency->trust_account_number
            ? substr(preg_replace('/\s/', '', (string) $agency->trust_account_number), -4)
            : null;

        // ----- Revenue contribution by agent (YTD)
        $perAgent = Commission::query()
            ->where('agency_id', $agency->id)
            ->whereDate('created_at', '>=', $yearStart)
            ->selectRaw("
                agent_id,
                SUM(CASE WHEN deal_type='sale' THEN deal_value ELSE 0 END) as sales_gmv,
                SUM(CASE WHEN deal_type='rental' THEN deal_value ELSE 0 END) as rental_gmv,
                SUM(gross_commission) as gross_commission,
                SUM(CASE WHEN status='paid' THEN agent_net ELSE 0 END) as paid_to_agent,
                SUM(agency_amount) as agency_net
            ")
            ->groupBy('agent_id')
            ->with('agent:id,name')
            ->orderByDesc('gross_commission')
            ->get();

        $contribution = $perAgent->map(fn ($row) => [
            'agent_name' => $row->agent?->name ?? '—',
            'sales_gmv' => (float) $row->sales_gmv,
            'rental_gmv' => (float) $row->rental_gmv,
            'gross_commission' => (float) $row->gross_commission,
            'paid_to_agent' => (float) $row->paid_to_agent,
            'agency_net' => (float) $row->agency_net,
            'percent_of_revenue' => $gross > 0 ? round(((float) $row->gross_commission / $gross) * 100, 1) : 0,
        ]);

        // ----- Bi-monthly VAT period
        $periodEnd = $now->endOfMonth();
        if ($now->month % 2 !== 0) {
            $periodEnd = $periodEnd->addMonth()->endOfMonth();
        }
        $periodStart = $periodEnd->subMonth()->startOfMonth();
        $periodVat = (float) Commission::where('agency_id', $agency->id)
            ->whereBetween('created_at', [$periodStart, $periodEnd])
            ->sum('vat_amount');
        $filingDeadline = $periodEnd->addDays(25);

        return Inertia::render('Agency/Reports', [
            'agency' => [
                'id' => $agency->id,
                'name' => $agency->name,
                'trust_bank' => $agency->trust_bank,
                'trust_account_last4' => $trustAcctLast4,
            ],
            'income_statement' => [
                'gross_commission' => $gross,
                'agent_payouts' => $agentPaid,
                'vat_liability' => $vatLiability,
                'net_to_agency' => $netToAgency,
                'net_margin_pct' => $netMargin,
                'agent_payouts_pct' => $gross > 0 ? round(($agentPaid / $gross) * 100, 1) : 0,
            ],
            'cashflow' => $cashflow,
            'trust' => [
                'balance' => $trustBalance,
                'deposits_held' => $depositsHeld,
                'rent_in_transit' => $rentInTransit,
                'reconciled_at' => now()->toIso8601String(),
            ],
            'agent_contribution' => $contribution,
            'vat_period' => [
                'starts_on' => $periodStart->toDateString(),
                'ends_on' => $periodEnd->toDateString(),
                'amount' => $periodVat,
                'filing_deadline' => $filingDeadline->toDateString(),
            ],
        ]);
    }
}
