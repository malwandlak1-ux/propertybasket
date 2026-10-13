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
use Symfony\Component\HttpFoundation\StreamedResponse;

class FinanceController extends Controller
{
    use ResolvesContractor;

    public function index(Request $request): Response|StreamedResponse
    {
        $contractor = $this->resolveContractor($request);
        $now        = CarbonImmutable::now();
        $yearStart  = $now->startOfYear();
        $monthStart = $now->startOfMonth();
        $feePercent = PlatformPlans::CONTRACTOR_FEE_PERCENT;

        $paidYtd = MaintenanceInvoice::where('contractor_id', $contractor->id)
            ->whereNotNull('paid_at')
            ->where('paid_at', '>=', $yearStart)
            ->with('request')
            ->orderBy('paid_at')
            ->get();

        if ($request->query('export') === 'csv') {
            return $this->taxSummaryCsv($paidYtd, $feePercent, (int) $now->format('Y'));
        }

        $ytdGross   = (float) $paidYtd->sum('invoice_total');
        $ytdVat     = (float) $paidYtd->sum('vat_amount');
        $monthGross = (float) $paidYtd->filter(fn ($i) => $i->paid_at->gte($monthStart))->sum('invoice_total');

        $ytdFee   = $ytdGross * ($feePercent / 100);
        $monthFee = $monthGross * ($feePercent / 100);
        $ytdNet   = $ytdGross - $ytdFee;

        // Outstanding (submitted/approved but not paid)
        $outstanding = MaintenanceInvoice::where('contractor_id', $contractor->id)
            ->whereIn('status', ['submitted', 'approved'])
            ->sum('invoice_total');

        // Monthly trend (last 6 months): gross paid, fee, net
        $trend = [];
        for ($i = 5; $i >= 0; $i--) {
            $mo   = $now->subMonths($i)->startOfMonth();
            $next = $mo->addMonth();
            $sum  = (float) MaintenanceInvoice::where('contractor_id', $contractor->id)
                ->whereNotNull('paid_at')
                ->whereBetween('paid_at', [$mo, $next])
                ->sum('invoice_total');
            $trend[] = [
                'label'  => $mo->format('M'),
                'period' => $mo->format('Y-m'),
                'gross'  => $sum,
                'fee'    => round($sum * ($feePercent / 100), 2),
                'net'    => round($sum * (1 - $feePercent / 100), 2),
            ];
        }

        // Earnings by job category (YTD, gross)
        $byCategory = $paidYtd->groupBy(fn ($i) => ucfirst($i->request?->category ?? 'other'))
            ->map(fn ($g, $cat) => ['category' => $cat, 'gross' => (float) $g->sum('invoice_total'), 'jobs' => $g->count()])
            ->sortByDesc('gross')->values()->all();

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
            'year'    => (int) $now->format('Y'),
            'kpis'    => [
                'ytd_gross'   => $ytdGross,
                'ytd_net'     => $ytdNet,
                'ytd_fee'     => $ytdFee,
                'ytd_vat'     => $ytdVat,
                'ytd_jobs'    => $paidYtd->count(),
                'month_gross' => $monthGross,
                'month_fee'   => $monthFee,
                'outstanding' => (float) $outstanding,
                'fee_percent' => (float) $feePercent,
                'next_payout' => $nextPayout,
            ],
            'trend'       => $trend,
            'by_category' => $byCategory,
            'payouts'     => $payouts->values(),
            'vat_registered' => (bool) $contractor->vat_registered,
            'vat_number'     => $contractor->vat_number,
        ]);
    }

    /** GET /contractor/finance?export=csv — paid invoices this year for the tax return. */
    private function taxSummaryCsv($invoices, float $feePercent, int $year): StreamedResponse
    {
        return response()->streamDownload(function () use ($invoices, $feePercent) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['paid_on', 'reference', 'job', 'gross_zar', 'vat_zar', 'platform_fee_zar', 'net_zar']);
            foreach ($invoices as $inv) {
                $gross = (float) $inv->invoice_total;
                $fee   = round($gross * ($feePercent / 100), 2);
                fputcsv($out, [
                    $inv->paid_at->toDateString(),
                    'INV-' . str_pad((string) $inv->id, 6, '0', STR_PAD_LEFT),
                    $inv->request?->title ?? 'Invoice',
                    number_format($gross, 2, '.', ''),
                    number_format((float) $inv->vat_amount, 2, '.', ''),
                    number_format($fee, 2, '.', ''),
                    number_format($gross - $fee, 2, '.', ''),
                ]);
            }
            fclose($out);
        }, "tax-summary-{$year}.csv", ['Content-Type' => 'text/csv']);
    }
}
