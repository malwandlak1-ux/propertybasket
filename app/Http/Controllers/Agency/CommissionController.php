<?php

namespace App\Http\Controllers\Agency;

use App\Http\Controllers\Agency\Concerns\ResolvesAgency;
use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\Commission;
use App\Models\MaintenanceInvoice;
use App\Models\PayoutBatch;
use App\Models\User;
use App\Notifications\CommissionApproved;
use App\Notifications\CommissionPaid;
use App\Notifications\MaintenanceInvoicePaid;
use App\Services\CommissionService;
use App\Services\PaystackService;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class CommissionController extends Controller
{
    use ResolvesAgency;

    public function __construct(
        private readonly CommissionService $commissionService,
        private readonly PaystackService $paystackService,
    ) {}

    public function index(Request $request): Response
    {
        $agency = $this->resolveAgency($request);
        $now = CarbonImmutable::now();
        $yearStart = $now->startOfYear();

        $queue = Commission::query()
            ->where('agency_id', $agency->id)
            ->whereIn('status', ['pending', 'approved', 'blocked'])
            ->with(['agent:id,name,email,paystack_recipient_code'])
            ->orderByDesc('agent_net')
            ->get()
            ->map(fn ($c) => $this->formatCommission($c));

        $totals = [
            'gross' => (float) $queue->sum('gross_commission'),
            'vat' => (float) $queue->sum('vat_amount'),
            'agent_net' => (float) $queue->sum('agent_net'),
            'count_eligible' => $queue->where('status', '!=', 'blocked')->count(),
            'count_total' => $queue->count(),
        ];

        $paidYtd = (float) Commission::query()
            ->where('agency_id', $agency->id)
            ->where('status', 'paid')
            ->whereDate('paid_at', '>=', $yearStart)
            ->sum('agent_net');

        $agencyRetainedYtd = (float) Commission::query()
            ->where('agency_id', $agency->id)
            ->whereIn('status', ['paid', 'approved'])
            ->whereDate('created_at', '>=', $yearStart)
            ->sum('agency_amount');

        $vatYtd = (float) Commission::query()
            ->where('agency_id', $agency->id)
            ->whereDate('created_at', '>=', $yearStart)
            ->sum('vat_amount');

        $nextBatch = PayoutBatch::query()
            ->where('agency_id', $agency->id)
            ->whereIn('status', ['pending', 'approved'])
            ->orderBy('batch_date')
            ->first();

        $recentTransfers = PayoutBatch::query()
            ->where('agency_id', $agency->id)
            ->where('status', 'completed')
            ->orderByDesc('batch_date')
            ->take(4)
            ->get(['id', 'batch_date', 'total_agent_net'])
            ->map(fn ($b) => [
                'id' => $b->id,
                'batch_date' => $b->batch_date->toDateString(),
                'total_agent_net' => (float) $b->total_agent_net,
                'commissions_count' => $b->commissions()->count(),
            ]);

        return Inertia::render('Agency/Commission', [
            'agency' => [
                'id' => $agency->id,
                'name' => $agency->name,
                'payout_day' => $agency->payout_day,
                'vat_rate' => (float) $agency->vat_rate,
                'sale_commission_percent' => (float) ($agency->sale_commission_percent ?? 6.0),
                'rental_commission_percent' => (float) ($agency->rental_commission_percent ?? 7.5),
            ],
            'commissions' => $queue->values(),
            'totals' => $totals,
            'next_batch' => $nextBatch ? [
                'id' => $nextBatch->id,
                'batch_date' => $nextBatch->batch_date->toDateString(),
                'days_away' => max(0, (int) $now->diffInDays($nextBatch->batch_date, false)),
                'total_gross' => (float) $nextBatch->total_gross,
                'total_vat' => (float) $nextBatch->total_vat,
                'total_agent_net' => (float) $nextBatch->total_agent_net,
                'status' => $nextBatch->status,
                'commissions_count' => $nextBatch->commissions()->count(),
            ] : null,
            'paid_ytd' => $paidYtd,
            'agency_retained_ytd' => $agencyRetainedYtd,
            'vat_ytd' => $vatYtd,
            'recent_transfers' => $recentTransfers,
            'contractor_invoices' => $this->contractorInvoices($agency),
        ]);
    }

    /**
     * Contractor invoices on the agency's properties: the unpaid queue
     * (submitted/approved) plus the most recent payments.
     */
    private function contractorInvoices(Agency $agency): array
    {
        $base = MaintenanceInvoice::query()
            ->whereHas('request.property', fn ($q) => $q
                ->where('owner_type', Agency::class)
                ->where('owner_id', $agency->id))
            ->with(['contractor.user:id,name,email,phone', 'request:id,title,property_id']);

        $mask = fn (?string $n) => $n ? '•••• ' . substr($n, -4) : null;

        $map = function (MaintenanceInvoice $i) use ($mask) {
            $c = $i->contractor;
            $hasBanking = $c?->hasBankingDetails() ?? false;

            return [
                'id'             => $i->id,
                'reference'      => 'INV-' . str_pad((string) $i->id, 6, '0', STR_PAD_LEFT),
                'contractor'     => $c?->business_name ?? '—',
                'job'            => $i->request?->title ?? '—',
                'subtotal'       => (float) $i->invoice_subtotal,
                'vat'            => (float) $i->vat_amount,
                'total'          => (float) $i->invoice_total,
                'deviation'      => (float) $i->deviation_amount,
                'status'         => $i->status,
                'submitted_at'   => $i->submitted_at?->format('d M Y'),
                'paid_at'        => $i->paid_at?->format('d M Y'),
                'has_banking'    => $hasBanking,
                'banking'        => $hasBanking ? [
                    'bank_name'      => $c->bank_name,
                    'account_holder' => $c->bank_account_holder,
                    'account_number' => $mask($c->bank_account_number),
                    'branch_code'    => $c->bank_branch_code,
                    'account_type'   => $c->bank_account_type,
                ] : null,
                'contact'        => [
                    'name'  => $c?->user?->name,
                    'email' => $c?->user?->email,
                    'phone' => $c?->user?->phone,
                ],
            ];
        };

        return [
            'queue' => (clone $base)
                ->whereIn('status', ['submitted', 'approved'])
                ->orderByDesc('submitted_at')
                ->get()->map($map)->values()->all(),
            'paid' => (clone $base)
                ->where('status', 'paid')
                ->orderByDesc('paid_at')
                ->limit(5)
                ->get()->map($map)->values()->all(),
        ];
    }

    /**
     * POST /agency/commissions/invoices/{invoice}/pay — pay a contractor
     * invoice to the contractor's linked account (Paystack stub in dev) and
     * notify the contractor.
     */
    public function payInvoice(Request $request, MaintenanceInvoice $invoice): RedirectResponse
    {
        $agency = $this->resolveAgency($request);

        $invoice->loadMissing(['request.property', 'contractor.user']);
        abort_unless(
            $invoice->request?->property?->owner_type === Agency::class
                && $invoice->request->property->owner_id === $agency->id,
            403,
            'You can only pay invoices on your agency\'s properties.',
        );
        abort_unless(
            in_array($invoice->status, ['submitted', 'approved'], true),
            422,
            'Only submitted or approved invoices can be paid.',
        );
        abort_unless(
            $invoice->contractor?->hasBankingDetails() ?? false,
            422,
            'This contractor has not captured banking details yet. Ask them to add their payout account first.',
        );

        $invoice->update([
            'status'             => 'paid',
            'paid_at'            => now(),
            'approved_at'        => $invoice->approved_at ?? now(),
            'paystack_reference' => 'PB_TRF_' . strtoupper(Str::random(12)),
        ]);

        // Close the loop on the job itself.
        if ($invoice->request && $invoice->request->status === 'completed') {
            $invoice->request->update(['status' => 'paid']);
        }

        if ($invoice->contractor?->user) {
            try {
                $invoice->contractor->user->notify(new MaintenanceInvoicePaid($invoice));
            } catch (\Throwable $e) {
                report($e);
            }
        }

        $name = $invoice->contractor?->business_name ?? 'the contractor';

        return back()->with('success', "Invoice paid — R " . number_format((float) $invoice->invoice_total, 2) . " transferred to {$name}.");
    }

    public function approve(Request $request): RedirectResponse
    {
        $agency = $this->resolveAgency($request);

        $data = $request->validate([
            'commission_ids' => ['required', 'array', 'min:1'],
            'commission_ids.*' => ['integer'],
        ]);

        // Pull the matching rows first so we can notify agents per-agent.
        $matched = Commission::query()
            ->where('agency_id', $agency->id)
            ->whereIn('id', $data['commission_ids'])
            ->where('status', 'pending')
            ->get();

        $updated = $matched->count();
        if ($updated > 0) {
            Commission::whereIn('id', $matched->pluck('id'))->update(['status' => 'approved']);

            // Re-fetch with status now=approved and notify each affected agent.
            $byAgent = $matched->groupBy('agent_id');
            foreach ($byAgent as $agentId => $rows) {
                if ($agent = User::find($agentId)) {
                    $agent->notify(new CommissionApproved($rows));
                }
            }
        }

        return back()->with(
            'success',
            $updated === 0
                ? 'No pending commissions matched. Blocked entries cannot be approved until compliance is fixed.'
                : "$updated commission".($updated === 1 ? '' : 's').' approved and queued for the next batch.'
        );
    }

    public function runPayout(Request $request): RedirectResponse
    {
        $agency = $this->resolveAgency($request);

        $batch = PayoutBatch::query()
            ->where('agency_id', $agency->id)
            ->whereIn('status', ['pending', 'approved'])
            ->orderBy('batch_date')
            ->first();

        if (! $batch) {
            // No open batch yet — bundle the agency's approved commissions into one
            $approvedCount = Commission::where('agency_id', $agency->id)
                ->where('status', 'approved')
                ->whereNull('payout_batch_id')
                ->count();
            if ($approvedCount === 0) {
                return back()->with('error', 'No approved commissions ready for payout.');
            }
            $batch = $this->commissionService->runMonthlyBatch($agency);
        }

        // Mark the batch approved, then run via Paystack stub
        $batch->update(['status' => 'approved']);
        $this->paystackService->runPayoutBatch($batch);

        // Notify each agent in this batch.
        $byAgent = $batch->commissions()->get()->groupBy('agent_id');
        foreach ($byAgent as $agentId => $rows) {
            if ($agent = User::find($agentId)) {
                $agent->notify(new CommissionPaid($batch, $rows));
            }
        }

        return back()->with(
            'success',
            'Payout batch #'.$batch->id.' completed via Paystack stub. '.$batch->commissions()->count().' transfer(s) processed.'
        );
    }

    /**
     * POST /agency/commissions/rates — set the agency's commission structure
     * for sales and rentals (applied to deals closed from now on).
     */
    public function updateRates(Request $request): RedirectResponse
    {
        $agency = $this->resolveAgency($request);

        $data = $request->validate([
            'sale_commission_percent'   => ['required', 'numeric', 'min:0', 'max:100'],
            'rental_commission_percent' => ['required', 'numeric', 'min:0', 'max:100'],
        ]);

        $agency->update([
            'sale_commission_percent'   => $data['sale_commission_percent'],
            'rental_commission_percent' => $data['rental_commission_percent'],
        ]);

        return back()->with('success', 'Commission structure updated. New deals will use these rates.');
    }

    private function formatCommission(Commission $c): array
    {
        $paystackStatus = match (true) {
            $c->status === 'blocked' && str_contains((string) $c->blocked_reason, 'paystack') => 'missing',
            ! empty($c->agent?->paystack_recipient_code) => 'verified',
            default => 'missing',
        };

        return [
            'id' => $c->id,
            'agent' => [
                'id' => $c->agent?->id,
                'name' => $c->agent?->name,
                'initials' => collect(explode(' ', (string) $c->agent?->name))
                    ->take(2)
                    ->map(fn ($w) => mb_substr($w, 0, 1))
                    ->implode(''),
            ],
            'deal_type' => $c->deal_type,
            'gross_commission' => (float) $c->gross_commission,
            'agent_split_percent' => (float) $c->agent_split_percent,
            'vat_amount' => (float) $c->vat_amount,
            'agent_net' => (float) $c->agent_net,
            'agency_amount' => (float) $c->agency_amount,
            'status' => $c->status,
            'blocked_reason' => $c->blocked_reason,
            'paystack_status' => $paystackStatus,
        ];
    }
}
