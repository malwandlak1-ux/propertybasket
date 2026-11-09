<?php

namespace App\Http\Controllers\Agency;

use App\Enums\Role;
use App\Http\Controllers\Agency\Concerns\ResolvesAgency;
use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\Commission;
use App\Models\MaintenanceInvoice;
use App\Models\PayoutBatch;
use App\Models\User;
use App\Notifications\CommissionApproved;
use App\Notifications\CommissionPaid;
use App\Services\CommissionService;
use App\Services\PaystackService;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Inertia\Inertia;
use Inertia\Response;

class CommissionController extends Controller
{
    use ResolvesAgency;

    public function __construct(
        private readonly CommissionService $commissionService,
        private readonly PaystackService $paystackService,
    ) {}

    /**
     * Money actions — running payouts, approving commissions, paying
     * contractor invoices and editing the commission structure — are
     * agency-admin only. Agents resolve their agency through the agents pivot
     * in ResolvesAgency, so without this guard they could POST to these routes
     * directly even though the UI never offers them the buttons. Block anyone
     * who isn't the agency admin (or a super admin acting on their behalf).
     */
    private function authorizeAgencyAdmin(Request $request): void
    {
        abort_unless(
            in_array($request->user()->role, [Role::AgencyAdmin, Role::SuperAdmin], true),
            403,
            'Only an agency admin can manage payouts and commission rates.',
        );
    }

    public function index(Request $request): Response
    {
        $agency = $this->resolveAgency($request);
        $now = CarbonImmutable::now();
        $yearStart = $now->startOfYear();

        // Re-evaluate any blocked commissions first — agents who have since
        // captured a payout method (Paystack OR banking) should unblock.
        Commission::where('agency_id', $agency->id)
            ->where('status', 'blocked')
            ->with('agent')
            ->get()
            ->each(fn ($c) => $this->commissionService->blockIfNonCompliant($c));

        $queue = Commission::query()
            ->where('agency_id', $agency->id)
            ->whereIn('status', ['pending', 'approved', 'blocked'])
            ->with(['agent:id,name,email,paystack_recipient_code,bank_account_holder,bank_account_number,bank_code'])
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

        // A trust-account (EFT) batch waiting for the agency to pay it from their bank.
        $eftBatch = PayoutBatch::query()
            ->where('agency_id', $agency->id)
            ->where('status', 'processing')
            ->where('method', 'trust_account')
            ->latest('id')
            ->first();

        $recentTransfers = PayoutBatch::query()
            ->where('agency_id', $agency->id)
            ->where('status', 'completed')
            ->orderByDesc('batch_date')
            ->take(4)
            ->get(['id', 'batch_date', 'total_agent_net', 'method', 'paid_reference'])
            ->map(fn ($b) => [
                'id' => $b->id,
                'batch_date' => $b->batch_date->toDateString(),
                'total_agent_net' => (float) $b->total_agent_net,
                'commissions_count' => $b->commissions()->count(),
                'method' => $b->method ?? 'paystack',
                'paid_reference' => $b->paid_reference,
            ]);

        return Inertia::render('Agency/Commission', [
            'agency' => [
                'id' => $agency->id,
                'name' => $agency->name,
                'payout_day' => $agency->payout_day,
                'vat_rate' => (float) $agency->vat_rate,
                'sale_commission_percent' => (float) ($agency->sale_commission_percent ?? 6.0),
                'rental_commission_percent' => (float) ($agency->rental_commission_percent ?? 7.5),
                'payout_method' => $agency->payout_method ?? 'paystack',
            ],
            'payout' => [
                'method'         => $agency->payout_method ?? 'paystack',
                'paystack_stub'  => $this->paystackService->isStub(),
                'trust_verified' => $agency->trustAccountVerified(),
                'trust_bank'     => $agency->trust_bank,
                'trust_account'  => $agency->trust_account_number ? '•••• ' . substr($agency->trust_account_number, -4) : null,
            ],
            'eft_batch' => $eftBatch ? $this->eftBatchPayload($eftBatch) : null,
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
        $this->authorizeAgencyAdmin($request);
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

        app(\App\Services\MaintenanceWorkflow::class)->markInvoicePaid($invoice, 'PB_TRF_' . strtoupper(Str::random(12)));

        $name = $invoice->contractor?->business_name ?? 'the contractor';

        return back()->with('success', "Invoice paid — R " . number_format((float) $invoice->invoice_total, 2) . " transferred to {$name}.");
    }

    public function approve(Request $request): RedirectResponse
    {
        $this->authorizeAgencyAdmin($request);
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
        $this->authorizeAgencyAdmin($request);
        $agency = $this->resolveAgency($request);

        if ($agency->paysFromTrustAccount()) {
            return $this->prepareTrustAccountBatch($agency);
        }

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

        // Mark the batch approved, then pay it through Paystack.
        $batch->update(['status' => 'approved', 'method' => 'paystack']);
        try {
            $this->paystackService->runPayoutBatch($batch);
        } catch (\Throwable $e) {
            report($e);
            $batch->update(['status' => 'pending']);

            return back()->with('error', 'Paystack payout failed: ' . $e->getMessage() . ' Nothing was marked paid.');
        }

        // Notify each agent in this batch.
        $byAgent = $batch->commissions()->get()->groupBy('agent_id');
        foreach ($byAgent as $agentId => $rows) {
            if ($agent = User::find($agentId)) {
                $agent->notify(new CommissionPaid($batch, $rows));
            }
        }

        return back()->with(
            'success',
            'Payout batch #'.$batch->id.' completed via Paystack'.($this->paystackService->isStub() ? ' (test mode)' : '').'. '.$batch->commissions()->count().' transfer(s) processed.'
        );
    }

    // ── Trust account (EFT) payouts ───────────────────────────────────────

    /**
     * Trust-account payouts: bundle the approved commissions into a batch the agency
     * pays itself (EFT from its trust account), using the bank file we generate.
     */
    private function prepareTrustAccountBatch(Agency $agency): RedirectResponse
    {
        if (! $agency->trustAccountVerified()) {
            return back()->with('error', 'Your trust account must be captured and verified by the platform before you can pay from it.');
        }
        if (PayoutBatch::where('agency_id', $agency->id)->where('status', 'processing')->where('method', 'trust_account')->exists()) {
            return back()->with('error', 'You already have an EFT payout waiting. Pay it from your trust account and mark it paid first.');
        }

        $batch = PayoutBatch::query()
            ->where('agency_id', $agency->id)
            ->whereIn('status', ['pending', 'approved'])
            ->orderBy('batch_date')
            ->first();
        if (! $batch) {
            $ready = Commission::where('agency_id', $agency->id)->where('status', 'approved')->whereNull('payout_batch_id')->count();
            if ($ready === 0) {
                return back()->with('error', 'No approved commissions ready for payout.');
            }
            $batch = $this->commissionService->runMonthlyBatch($agency);
        }

        $payable = $batch->commissions()->where('status', 'approved')->with('agent')->get();
        if ($payable->isEmpty()) {
            return back()->with('error', 'No approved commissions ready for payout.');
        }
        $noBank = $payable->map->agent->filter()->unique('id')
            ->filter(fn (User $a) => blank($a->bank_account_number) || blank($a->bank_code))
            ->pluck('name');
        if ($noBank->isNotEmpty()) {
            return back()->with('error', 'Can’t pay by EFT yet: ' . $noBank->implode(', ') . ' ' . ($noBank->count() === 1 ? 'has' : 'have') . ' no bank account number and branch code on file.');
        }

        $batch->update([
            'status'          => 'processing',
            'method'          => 'trust_account',
            'total_agent_net' => (float) $payable->sum('agent_net'),
        ]);

        return back()->with('success', "EFT payout #{$batch->id} is ready: download the payment file, pay it from your trust account, then mark it paid.");
    }

    /** GET /agency/commissions/batches/{batch}/eft.csv — bank bulk-payment file for a trust-account batch. */
    public function eftFile(Request $request, PayoutBatch $batch): StreamedResponse
    {
        $this->authorizeAgencyAdmin($request);
        $agency = $this->resolveAgency($request);
        abort_unless($batch->agency_id === $agency->id && $batch->method === 'trust_account', 404);

        $rows = $this->eftRows($batch);
        $filename = 'commission-payout-' . $batch->id . '-' . $batch->batch_date->format('Y-m-d') . '.csv';

        return response()->streamDownload(function () use ($rows, $agency, $batch) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['Beneficiary name', 'Bank', 'Account number', 'Branch code', 'Account type', 'Amount', 'Beneficiary reference', 'Own reference']);
            foreach ($rows as $r) {
                fputcsv($out, [$r['name'], $r['bank'], $r['account_number'], $r['branch_code'], $r['account_type'], number_format($r['amount'], 2, '.', ''), $r['reference'], mb_substr("{$agency->name} COMM #{$batch->id}", 0, 30)]);
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /** POST /agency/commissions/batches/{batch}/paid — the agency paid the EFT batch from its trust account. */
    public function markBatchPaid(Request $request, PayoutBatch $batch): RedirectResponse
    {
        $this->authorizeAgencyAdmin($request);
        $agency = $this->resolveAgency($request);
        abort_unless($batch->agency_id === $agency->id && $batch->method === 'trust_account', 404);
        if ($batch->status !== 'processing') {
            return back()->with('error', 'This payout has already been marked paid.');
        }
        $data = $request->validate(['reference' => ['nullable', 'string', 'max:80']]);

        $paid = $batch->commissions()->where('status', 'approved')->get();
        DB::transaction(function () use ($batch, $paid, $data) {
            foreach ($paid as $c) {
                $c->update(['status' => 'paid', 'paid_at' => now()]);
            }
            $batch->update(['status' => 'completed', 'paid_reference' => $data['reference'] ?? null, 'paid_at' => now()]);
        });

        foreach ($paid->groupBy('agent_id') as $agentId => $rows) {
            try {
                User::find($agentId)?->notify(new CommissionPaid($batch, $rows));
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return back()->with('success', "EFT payout #{$batch->id} marked paid — {$paid->count()} commission" . ($paid->count() === 1 ? '' : 's') . ' settled and agents notified.');
    }

    /** One line per agent (their commissions in the batch added together). */
    private function eftRows(PayoutBatch $batch): array
    {
        return $batch->commissions()->where('status', 'approved')->with('agent')->get()
            ->groupBy('agent_id')
            ->map(function ($rows) use ($batch) {
                $a = $rows->first()->agent;

                return [
                    'agent_id'       => $a?->id,
                    'name'           => $a?->bank_account_holder ?: $a?->name,
                    'agent'          => $a?->name,
                    'bank'           => $a?->bank_name,
                    'account_number' => $a?->bank_account_number,
                    'branch_code'    => $a?->bank_code,
                    'account_type'   => $a?->bank_account_type,
                    'amount'         => round((float) $rows->sum('agent_net'), 2),
                    'deals'          => $rows->count(),
                    'reference'      => mb_substr('COMMISSION ' . $batch->batch_date->format('M Y'), 0, 20),
                ];
            })->values()->all();
    }

    private function eftBatchPayload(PayoutBatch $batch): array
    {
        $rows = $this->eftRows($batch);

        return [
            'id'         => $batch->id,
            'batch_date' => $batch->batch_date->toDateString(),
            'total'      => round(array_sum(array_column($rows, 'amount')), 2),
            'payees'     => array_map(fn ($r) => [
                'agent'   => $r['agent'],
                'bank'    => $r['bank'],
                'account' => $r['account_number'] ? '•••• ' . substr((string) $r['account_number'], -4) : null,
                'amount'  => $r['amount'],
                'deals'   => $r['deals'],
            ], $rows),
            'file_url'   => route('agency.commissions.batches.eft', $batch),
        ];
    }

    /**
     * POST /agency/commissions/rates — set the agency's commission structure
     * for sales and rentals (applied to deals closed from now on).
     */
    public function updateRates(Request $request): RedirectResponse
    {
        $this->authorizeAgencyAdmin($request);
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
        // Payable on Paystack OR captured banking details.
        $payoutStatus = ($c->agent?->hasPayoutDetails() ?? false) ? 'verified' : 'missing';
        $payoutMethod = match (true) {
            ! empty($c->agent?->paystack_recipient_code) => 'paystack',
            ! empty($c->agent?->bank_account_number) => 'bank',
            default => null,
        };

        return [
            'payout_status' => $payoutStatus,
            'payout_method' => $payoutMethod,
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
            'paystack_status' => $payoutStatus,
        ];
    }
}
