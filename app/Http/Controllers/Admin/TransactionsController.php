<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\EnsuresSuperAdmin;
use App\Models\Agency;
use App\Models\Landlord;
use App\Support\PlatformPlans;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Inertia\Inertia;
use Inertia\Response;

class TransactionsController extends Controller
{
    use EnsuresSuperAdmin;

    public function index(Request $request): Response
    {
        $this->ensureSuperAdmin($request);

        $rangeKey = $request->string('range', 'month')->toString();

        $now    = CarbonImmutable::now();
        $period = match ($rangeKey) {
            'week'    => $now->subDays(7),
            'quarter' => $now->subMonths(3),
            'year'    => $now->subYear(),
            default   => $now->subMonths(1),
        };

        // ── Build synthetic Paystack transaction log ──────────────────────
        // Real implementation would query a `paystack_charges` table.
        $rows = $this->syntheticTransactions($period, $now);

        $collected     = collect($rows)->where('status', 'paid')->where('type', 'subscription')->sum('amount');
        $platformFees  = collect($rows)->where('status', 'paid')->where('type', 'platform_fee')->sum('amount');
        $failedCount   = collect($rows)->where('status', 'failed')->count();
        $churnPct      = 1.2; // stub

        return Inertia::render('Admin/Transactions', [
            'counts'         => $this->sidebarCounts(),
            'range'          => $rangeKey,
            'kpis'           => [
                'collected'    => (float) $collected,
                'platform_fees'=> (float) $platformFees,
                'failed_count' => $failedCount,
                'churn_pct'    => $churnPct,
            ],
            'transactions'   => $rows,
        ]);
    }

    /**
     * Returns a synthetic ledger of recent Paystack charges combining
     * subscription debits and per-job contractor platform fees.
     */
    private function syntheticTransactions(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $plans = PlatformPlans::all();
        $rows  = [];
        $id    = 8800;

        // Subscription charges for active agencies (one per month)
        $agencies = Agency::with('owner')->orderByDesc('id')->get();
        foreach ($agencies as $a) {
            $plan = $plans[$a->subscription_plan] ?? null;
            if (! $plan) {
                continue;
            }

            $status = $a->status === 'suspended' ? 'failed' : 'paid';
            $rows[] = [
                'id'        => $id,
                'date'      => $to->subDays($a->id % 12 + 2)->toDateString(),
                'account'   => $a->name,
                'type'      => 'subscription',
                'type_label'=> 'Subscription',
                'reference' => 'PYS_SUB_' . $id,
                'amount'    => $plan['price'],
                'status'    => $status,
            ];
            $id++;
        }

        // Subscription charges for landlords (one per month each)
        $landlordPrice = $plans[PlatformPlans::LANDLORD_PRIVATE]['price'];
        $landlords = Landlord::with('user')->orderByDesc('id')->get();
        foreach ($landlords as $l) {
            $rows[] = [
                'id'        => $id,
                'date'      => $to->subDays($l->id % 7 + 1)->toDateString(),
                'account'   => $l->user?->name ?? '—',
                'type'      => 'subscription',
                'type_label'=> 'Subscription',
                'reference' => 'PYS_SUB_' . $id,
                'amount'    => $landlordPrice,
                'status'    => 'paid',
            ];
            $id++;
        }

        // A couple of contractor platform-fee charges
        $contractorFees = [
            ['account' => 'Jacob Mokoena',  'amount' => 460,  'days_ago' => 2],
            ['account' => 'Sipho Mahlangu', 'amount' => 320,  'days_ago' => 4],
        ];
        foreach ($contractorFees as $cf) {
            $rows[] = [
                'id'        => $id,
                'date'      => $to->subDays($cf['days_ago'])->toDateString(),
                'account'   => $cf['account'],
                'type'      => 'platform_fee',
                'type_label'=> 'Platform fee',
                'reference' => 'PYS_FEE_' . $id,
                'amount'    => $cf['amount'],
                'status'    => 'paid',
            ];
            $id++;
        }

        // Filter to date range and sort desc
        $filtered = array_filter($rows, fn ($r) => $r['date'] >= $from->toDateString());
        usort($filtered, fn ($a, $b) => strcmp($b['date'], $a['date']));

        return array_values($filtered);
    }
}
