<?php

namespace App\Http\Controllers\Landlord;

use App\Http\Controllers\Agency\MaintenanceController as AgencyMaintenance;
use App\Http\Controllers\Landlord\Concerns\ResolvesLandlord;
use App\Models\Contractor;
use App\Models\ContractorRating;
use App\Models\Landlord;
use App\Models\MaintenanceInvoice;
use App\Models\MaintenanceQuote;
use App\Models\MaintenanceRequest;
use App\Notifications\MaintenanceJobAssigned;
use App\Services\MaintenanceWorkflow;
use App\Support\Edition;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Landlord-run maintenance: request a quote from a contractor, approve or
 * reject quotes, settle the contractor's invoice and rate the work.
 */
class MaintenanceController extends Controller
{
    use ResolvesLandlord;

    public function index(Request $request): Response
    {
        $landlord   = $this->resolveLandlord($request);
        $listingIds = $landlord->listings()->pluck('id');
        $userId     = $request->user()->id;

        $requests = MaintenanceRequest::whereIn('property_id', $listingIds)
            ->with(['property', 'submitter', 'contractor', 'quotes.contractor.user'])
            ->orderByRaw("CASE status WHEN 'open' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'completed' THEN 3 WHEN 'paid' THEN 4 ELSE 5 END")
            ->orderByRaw("CASE urgency WHEN 'emergency' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END")
            ->orderByDesc('created_at')
            ->get();

        $invoices = MaintenanceInvoice::whereIn('maintenance_request_id', $requests->pluck('id'))
            ->where('status', '!=', 'draft')
            ->with('contractor')
            ->orderByDesc('id')
            ->get()
            ->unique('maintenance_request_id')
            ->keyBy('maintenance_request_id');

        $grouped = ['open' => [], 'in_progress' => [], 'completed' => [], 'paid' => []];

        foreach ($requests as $req) {
            $key = in_array($req->status, ['in_progress', 'completed', 'paid'], true) ? $req->status : 'open';
            $grouped[$key][] = $this->mapRequest($req, $invoices->get($req->id), $userId);
        }

        return Inertia::render('Landlord/Maintenance', [
            'landlord'    => ['id' => $landlord->id, 'name' => $request->user()->name],
            'grouped'     => $grouped,
            'counts'      => array_map('count', $grouped),
            'contractors' => $this->pickers($landlord),
        ]);
    }

    /** POST /landlord/maintenance/{maintenanceRequest}/assign — request a quote from a contractor. */
    public function assign(Request $request, MaintenanceRequest $maintenanceRequest): RedirectResponse
    {
        $landlord = $this->resolveLandlord($request);
        $this->authorise($maintenanceRequest, $landlord);
        abort_unless(in_array($maintenanceRequest->status, ['open', 'awaiting_quotes'], true), 422, 'This job is already under way.');

        $data = $request->validate(['contractor_id' => ['required', 'integer', 'exists:contractors,id']]);
        $contractor = Contractor::with('user')->findOrFail($data['contractor_id']);

        $onRoster = $landlord->contractors()->whereKey($contractor->id)->exists();
        $marketOk = Edition::marketplaceEnabled()
            && $contractor->created_by_agency_id === null
            && $contractor->created_by_landlord_id === null;
        abort_unless(($onRoster || $marketOk) && $contractor->status === 'active', 403, 'Pick a contractor from your list.');

        // Re-allocating: withdraw quotes the previous contractor had pending.
        if ($maintenanceRequest->assigned_to && $maintenanceRequest->assigned_to !== $contractor->user_id) {
            MaintenanceQuote::where('maintenance_request_id', $maintenanceRequest->id)
                ->whereIn('status', ['draft', 'sent'])
                ->update(['status' => 'rejected']);
        }

        $maintenanceRequest->update(['assigned_to' => $contractor->user_id, 'status' => 'open']);

        try {
            $contractor->user?->notify(new MaintenanceJobAssigned($maintenanceRequest->fresh('property')));
        } catch (\Throwable $e) {
            report($e);
        }

        $name = $contractor->business_name ?? $contractor->user?->name ?? 'the contractor';

        return back()->with('success', "Quote requested from {$name}. You'll be notified when it arrives.");
    }

    /** POST /landlord/maintenance/quotes/{quote}/accept */
    public function acceptQuote(Request $request, MaintenanceQuote $quote, MaintenanceWorkflow $workflow): RedirectResponse
    {
        $landlord = $this->resolveLandlord($request);
        $this->authorise($quote->request, $landlord);
        abort_unless($quote->status === 'sent', 422, 'Only quotes awaiting review can be accepted.');

        $workflow->acceptQuote($quote);

        return back()->with('success', 'Quote accepted. The contractor can now schedule the work.');
    }

    /** POST /landlord/maintenance/quotes/{quote}/reject */
    public function rejectQuote(Request $request, MaintenanceQuote $quote, MaintenanceWorkflow $workflow): RedirectResponse
    {
        $landlord = $this->resolveLandlord($request);
        $this->authorise($quote->request, $landlord);
        abort_unless($quote->status === 'sent', 422, 'Only quotes awaiting review can be rejected.');

        $workflow->rejectQuote($quote);

        return back()->with('success', 'Quote rejected. The contractor can send a revised quote, or you can ask someone else.');
    }

    /**
     * POST /landlord/maintenance/invoices/{invoice}/paid — the landlord paid
     * the contractor directly (EFT) and records it here.
     */
    public function markInvoicePaid(Request $request, MaintenanceInvoice $invoice, MaintenanceWorkflow $workflow): RedirectResponse
    {
        $landlord = $this->resolveLandlord($request);
        $this->authorise($invoice->request, $landlord);
        abort_unless(in_array($invoice->status, ['submitted', 'approved'], true), 422, 'Only submitted invoices can be marked as paid.');

        $workflow->markInvoicePaid($invoice, MaintenanceWorkflow::manualReference());

        return back()->with('success', 'Invoice marked as paid. The job is closed and the contractor has been notified.');
    }

    /** POST /landlord/maintenance/{maintenanceRequest}/rate */
    public function rate(Request $request, MaintenanceRequest $maintenanceRequest): RedirectResponse
    {
        $landlord = $this->resolveLandlord($request);
        $this->authorise($maintenanceRequest, $landlord);

        return AgencyMaintenance::applyRating($request, $maintenanceRequest);
    }

    private function authorise(?MaintenanceRequest $r, Landlord $landlord): void
    {
        abort_unless(
            $r !== null && $landlord->listings()->whereKey($r->property_id)->exists(),
            403,
            'You can only manage maintenance on your own properties.',
        );
    }

    private function pickers(Landlord $landlord): array
    {
        $map = fn (Contractor $c) => [
            'id'             => $c->id,
            'business_name'  => $c->business_name,
            'contact_name'   => $c->user?->name,
            'specialities'   => is_array($c->specialities) ? $c->specialities : [],
            'average_rating' => (float) $c->average_rating,
            'total_jobs'     => (int) $c->total_jobs,
            'invited'        => $c->user?->status?->value !== 'active',
        ];

        $mine = $landlord->contractors()->with('user:id,name,status')
            ->where('contractors.status', 'active')
            ->orderBy('business_name')
            ->get();

        return [
            'mine'   => $mine->map($map)->values()->all(),
            'market' => Edition::marketplaceEnabled()
                ? Contractor::with('user:id,name,status')
                    ->whereNull('created_by_agency_id')
                    ->whereNull('created_by_landlord_id')
                    ->whereNotIn('id', $mine->pluck('id'))
                    ->where('status', 'active')
                    ->orderByDesc('average_rating')
                    ->limit(50)
                    ->get()->map($map)->values()->all()
                : [],
            'marketplace_enabled' => Edition::marketplaceEnabled(),
        ];
    }

    private function mapRequest(MaintenanceRequest $req, ?MaintenanceInvoice $invoice, int $userId): array
    {
        $quotes = $req->quotes
            ->whereIn('status', ['sent', 'accepted', 'rejected'])
            ->sortByDesc('id')
            ->values();

        $pending  = $quotes->where('status', 'sent')->count();
        $accepted = $quotes->firstWhere('status', 'accepted');

        $stage = match (true) {
            $req->status === 'paid'                                => 'paid',
            $req->status === 'completed' && $invoice !== null
                && $invoice->status !== 'paid'                     => 'invoice_review',
            $req->status === 'completed'                           => 'awaiting_invoice',
            $req->status === 'in_progress'                         => 'in_progress',
            $pending > 0                                           => 'quote_review',
            $accepted !== null                                     => 'scheduling',
            $req->assigned_to !== null                             => 'awaiting_quote',
            default                                                => 'needs_contractor',
        };

        $myRating = null;
        if (in_array($req->status, ['completed', 'paid'], true) && $req->assigned_to) {
            $myRating = ContractorRating::where('maintenance_request_id', $req->id)->where('rated_by', $userId)->value('rating');
        }

        $photos = array_values(array_filter(array_map(
            fn ($p) => is_string($p) ? $p : ($p['url'] ?? ''),
            is_array($req->photos) ? $req->photos : [],
        )));

        return [
            'id'             => $req->id,
            'title'          => $req->title,
            'description'    => $req->description,
            'category'       => $req->category,
            'urgency'        => $req->urgency,
            'status'         => $req->status,
            'stage'          => $stage,
            'property'       => $req->property?->address ?: ($req->property?->title ?? $req->property?->suburb),
            'tenant_name'    => $req->submitter?->name,
            'tenant_phone'   => $req->submitter?->phone,
            'contractor'     => $req->contractor?->name,
            'photos'         => $photos,
            'photos_count'   => count($photos),
            'preferred'      => $req->preferred_date?->format('d M Y'),
            'created_at'     => $req->created_at?->diffForHumans(),
            'completed_at'   => $req->completed_at?->format('d M Y'),
            'pending_quotes' => $pending,
            'quotes'         => $quotes->map(fn (MaintenanceQuote $q) => [
                'id'          => $q->id,
                'reference'   => 'QT-' . str_pad((string) $q->id, 6, '0', STR_PAD_LEFT),
                'contractor'  => $q->contractor?->business_name ?? $q->contractor?->user?->name ?? 'Contractor',
                'status'      => $q->status,
                'lines'       => self::lines($q->line_items),
                'subtotal'    => (float) $q->subtotal,
                'vat'         => (float) $q->vat_amount,
                'total'       => (float) $q->total,
                'notes'       => $q->notes,
                'sent_at'     => $q->sent_at?->format('d M Y'),
                'valid_until' => $q->valid_until?->format('d M Y'),
            ])->all(),
            'invoice'        => $invoice ? [
                'id'              => $invoice->id,
                'reference'       => 'INV-' . str_pad((string) $invoice->id, 6, '0', STR_PAD_LEFT),
                'status'          => $invoice->status,
                'lines'           => self::lines($invoice->line_items),
                'subtotal'        => (float) $invoice->invoice_subtotal,
                'vat'             => (float) $invoice->vat_amount,
                'total'           => (float) $invoice->invoice_total,
                'quote_total'     => $invoice->original_quote_total !== null ? (float) $invoice->original_quote_total : null,
                'deviation'       => (float) $invoice->deviation_amount,
                'deviation_notes' => $invoice->deviation_notes,
                'submitted_at'    => $invoice->submitted_at?->format('d M Y'),
                'paid_at'         => $invoice->paid_at?->format('d M Y'),
                'bank'            => $invoice->contractor?->hasBankingDetails() ? [
                    'bank'    => $invoice->contractor->bank_name,
                    'holder'  => $invoice->contractor->bank_account_holder,
                    'account' => $invoice->contractor->bank_account_number,
                    'branch'  => $invoice->contractor->bank_branch_code,
                    'type'    => $invoice->contractor->bank_account_type,
                ] : null,
            ] : null,
            'can_rate'       => in_array($req->status, ['completed', 'paid'], true) && $req->assigned_to !== null,
            'my_rating'      => $myRating,
        ];
    }

    /** Line items in one shape (older rows used desc/unit). */
    private static function lines($items): array
    {
        return collect(is_array($items) ? $items : [])->map(function ($l) {
            $qty   = (float) ($l['qty'] ?? 1);
            $price = (float) ($l['unit_price'] ?? $l['unit'] ?? 0);

            return [
                'label'      => $l['label'] ?? $l['desc'] ?? 'Item',
                'qty'        => $qty,
                'unit_price' => $price,
                'line_total' => (float) ($l['line_total'] ?? round($qty * $price, 2)),
            ];
        })->values()->all();
    }
}
