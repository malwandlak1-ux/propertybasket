<?php

namespace App\Http\Controllers\Contractor;

use App\Http\Controllers\Contractor\Concerns\ResolvesContractor;
use App\Models\MaintenanceInvoice;
use App\Support\PlatformPlans;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Inertia\Inertia;
use Inertia\Response;

class FinanceController extends Controller
{
    use ResolvesContractor;

    public function index(Request $request): Response
    {
        $contractor = $this->resolveContractor($request);
        $now        = CarbonImmutable::now();
        $yearStart  = $now->startOfYear();
        $monthStart = $now->startOfMonth();

        $allPaid = MaintenanceInvoice::where('contractor_id', $contractor->id)
            ->whereNotNull('paid_at');

        $ytdGross   = (clone $allPaid)->where('paid_at', '>=', $yearStart)->sum('invoice_total');
        $monthGross = (clone $allPaid)->where('paid_at', '>=', $monthStart)->sum('invoice_total');

        // Platform fee
        $feePercent = PlatformPlans::CONTRACTOR_FEE_PERCENT;
        $ytdFee     = $ytdGross * ($feePercent / 100);
        $monthFee   = $monthGross * ($feePercent / 100);
        $ytdNet     = $ytdGross - $ytdFee;

        // Outstanding (submitted/approved but not paid)
        $outstanding = MaintenanceInvoice::where('contractor_id', $contractor->id)
            ->whereIn('status', ['submitted', 'approved'])
            ->sum('invoice_total');

        // Monthly trend (last 6 months)
        $trend = [];
        for ($i = 5; $i >= 0; $i--) {
            $mo   = $now->subMonths($i)->startOfMonth();
            $next = $mo->addMonth();
            $sum  = MaintenanceInvoice::where('contractor_id', $contractor->id)
                ->whereNotNull('paid_at')
                ->whereBetween('paid_at', [$mo, $next])
                ->sum('invoice_total');
            $trend[] = [
                'label'   => $mo->format('M'),
                'period'  => $mo->format('Y-m'),
                'gross'   => (float) $sum,
                'net'     => (float) $sum * (1 - $feePercent / 100),
            ];
        }

        // Recent payouts
        $payouts = MaintenanceInvoice::where('contractor_id', $contractor->id)
            ->whereNotNull('paid_at')
            ->with('request')
            ->orderByDesc('paid_at')
            ->limit(15)
            ->get()
            ->map(fn ($inv) => [
                'id'        => $inv->id,
                'reference' => 'PAY-' . str_pad((string) $inv->id, 6, '0', STR_PAD_LEFT),
                'title'     => $inv->request?->title ?? 'Invoice',
                'paid_at'   => $inv->paid_at?->format('d M Y'),
                'gross'     => (float) $inv->invoice_total,
                'fee'       => (float) $inv->invoice_total * ($feePercent / 100),
                'net'       => (float) $inv->invoice_total * (1 - $feePercent / 100),
            ]);

        // Next payout date — Paystack runs Wednesdays for completed/approved invoices
        $nextPayout = $now->next(\Carbon\Carbon::WEDNESDAY)->format('d M Y');

        return Inertia::render('Contractor/Finance', [
            'counts'  => $this->sidebarCounts($contractor),
            'kpis'    => [
                'ytd_gross'   => (float) $ytdGross,
                'ytd_net'     => (float) $ytdNet,
                'ytd_fee'     => (float) $ytdFee,
                'month_gross' => (float) $monthGross,
                'month_fee'   => (float) $monthFee,
                'outstanding' => (float) $outstanding,
                'fee_percent' => (float) $feePercent,
                'next_payout' => $nextPayout,
            ],
            'trend'   => $trend,
            'payouts' => $payouts->values(),
            'vat_registered' => (bool) $contractor->vat_registered,
            'vat_number'     => $contractor->vat_number,
        ]);
    }
}
