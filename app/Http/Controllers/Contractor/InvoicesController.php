<?php

namespace App\Http\Controllers\Contractor;

use App\Http\Controllers\Contractor\Concerns\ResolvesContractor;
use App\Models\MaintenanceInvoice;
use App\Models\MaintenanceQuote;
use App\Models\MaintenanceRequest;
use App\Services\PdfService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class InvoicesController extends Controller
{
    use ResolvesContractor;

    public function index(Request $request): Response
    {
        $contractor = $this->resolveContractor($request);

        $filter = $request->string('filter', 'all')->toString();

        $query = MaintenanceInvoice::where('contractor_id', $contractor->id)
            ->with(['request.property', 'request.submitter'])
            ->orderByDesc('updated_at');

        if (in_array($filter, ['draft', 'submitted', 'approved', 'paid', 'disputed'], true)) {
            $query->where('status', $filter);
        }

        $invoices = $query->limit(50)->get()->map(function ($inv) {
            $deviation = (float) ($inv->deviation_amount ?? 0);

            return [
                'id'            => $inv->id,
                'reference'     => 'INV-' . str_pad((string) $inv->id, 6, '0', STR_PAD_LEFT),
                'title'         => $inv->request?->title ?? 'Invoice',
                'agency'        => optional($inv->request?->property?->owner)->name ?? '—',
                'tenant'        => $inv->request?->submitter?->name ?? '—',
                'property'      => $inv->request?->property?->suburb ?? '—',
                'status'        => $inv->status,
                'subtotal'      => (float) $inv->invoice_subtotal,
                'vat'           => (float) $inv->vat_amount,
                'total'         => (float) $inv->invoice_total,
                'quote_total'   => (float) $inv->original_quote_total,
                'deviation'     => $deviation,
                'has_deviation' => abs($deviation) > 0.01,
                'submitted_at'  => $inv->submitted_at?->format('d M Y'),
                'approved_at'   => $inv->approved_at?->format('d M Y'),
                'paid_at'       => $inv->paid_at?->format('d M Y'),
                'updated'       => $inv->updated_at?->diffForHumans(),
            ];
        });

        $counts = [
            'all'       => MaintenanceInvoice::where('contractor_id', $contractor->id)->count(),
            'draft'     => MaintenanceInvoice::where('contractor_id', $contractor->id)->where('status', 'draft')->count(),
            'submitted' => MaintenanceInvoice::where('contractor_id', $contractor->id)->where('status', 'submitted')->count(),
            'approved'  => MaintenanceInvoice::where('contractor_id', $contractor->id)->where('status', 'approved')->count(),
            'paid'      => MaintenanceInvoice::where('contractor_id', $contractor->id)->where('status', 'paid')->count(),
            'disputed'  => MaintenanceInvoice::where('contractor_id', $contractor->id)->where('status', 'disputed')->count(),
        ];

        $outstanding = MaintenanceInvoice::where('contractor_id', $contractor->id)
            ->whereIn('status', ['submitted', 'approved'])
            ->sum('invoice_total');

        return Inertia::render('Contractor/Invoices', [
            'counts'           => $this->sidebarCounts($contractor),
            'invoices'         => $invoices->values(),
            'filter'           => $filter,
            'tab_counts'       => $counts,
            'outstanding'      => (float) $outstanding,
            'invoiceable_jobs' => $this->invoiceableJobs($contractor->user_id, $contractor->id),
            'vat_registered'   => (bool) $contractor->vat_registered,
            'vat_rate'         => 15.0,
        ]);
    }

    /**
     * POST /contractor/invoices — submit an invoice for a completed job. The
     * server computes totals and the signed deviation against any accepted
     * quote on the same job (so deviations are explicit, never silent).
     */
    public function store(Request $request): RedirectResponse
    {
        $contractor = $this->resolveContractor($request);

        $data = $request->validate([
            'maintenance_request_id' => ['required', 'integer', 'exists:maintenance_requests,id'],
            'line_items'             => ['required', 'array', 'min:1', 'max:30'],
            'line_items.*.label'     => ['required', 'string', 'max:160'],
            'line_items.*.qty'       => ['required', 'numeric', 'min:0.01', 'max:9999'],
            'line_items.*.unit_price'=> ['required', 'numeric', 'min:0', 'max:9999999'],
            'deviation_notes'        => ['nullable', 'string', 'max:2000'],
            'status'                 => ['nullable', Rule::in(['draft', 'submitted'])],
        ]);

        $req = MaintenanceRequest::findOrFail($data['maintenance_request_id']);
        abort_unless(
            $req->assigned_to === $contractor->user_id,
            403,
            'You can only invoice on jobs assigned to you.',
        );
        abort_unless(
            in_array($req->status, ['completed', 'in_progress', 'paid'], true),
            422,
            'You can only invoice jobs that have been started or completed.',
        );

        $lineItems = [];
        $subtotal  = 0.0;
        foreach ($data['line_items'] as $row) {
            $lineTotal = round(((float) $row['qty']) * ((float) $row['unit_price']), 2);
            $lineItems[] = [
                'label'      => $row['label'],
                'qty'        => (float) $row['qty'],
                'unit_price' => (float) $row['unit_price'],
                'line_total' => $lineTotal,
            ];
            $subtotal += $lineTotal;
        }
        $subtotal  = round($subtotal, 2);
        $vatAmount = $contractor->vat_registered ? round($subtotal * 0.15, 2) : 0.0;
        $total     = round($subtotal + $vatAmount, 2);

        // Prefer the most recent accepted quote, else the latest quote on file.
        $quote = MaintenanceQuote::where('maintenance_request_id', $req->id)
            ->where('contractor_id', $contractor->id)
            ->where('status', 'accepted')
            ->latest('id')
            ->first()
            ?? MaintenanceQuote::where('maintenance_request_id', $req->id)
                ->where('contractor_id', $contractor->id)
                ->latest('id')
                ->first();

        $quoteTotal = $quote ? (float) $quote->total : null;
        $deviation  = $quoteTotal !== null ? round($total - $quoteTotal, 2) : 0.0;

        // Force an explanation when the invoice diverges from the quote.
        if ($quoteTotal !== null && abs($deviation) > 0.01 && empty($data['deviation_notes'])) {
            return back()
                ->withInput()
                ->withErrors(['deviation_notes' => 'Total differs from the original quote. Please explain the deviation.']);
        }

        $status = $data['status'] ?? 'submitted';

        MaintenanceInvoice::create([
            'maintenance_request_id' => $req->id,
            'quote_id'               => $quote?->id,
            'contractor_id'          => $contractor->id,
            'line_items'             => $lineItems,
            'original_quote_total'   => $quoteTotal,
            'invoice_subtotal'       => $subtotal,
            'vat_amount'             => $vatAmount,
            'invoice_total'          => $total,
            'deviation_amount'       => $deviation,
            'deviation_notes'        => $data['deviation_notes'] ?? null,
            'status'                 => $status,
            'submitted_at'           => $status === 'submitted' ? now() : null,
        ]);

        return redirect()
            ->route('contractor.invoices.index', ['filter' => $status])
            ->with('success', $status === 'submitted'
                ? "Invoice submitted for \"{$req->title}\" — R" . number_format($total, 2) . '.'
                : "Draft invoice saved for \"{$req->title}\".");
    }

    /**
     * Jobs the contractor can invoice on. Includes any accepted/sent quote so
     * the modal can pre-fill the line items and flag deviations against it.
     */
    private function invoiceableJobs(int $userId, int $contractorId): array
    {
        $jobs = MaintenanceRequest::where('assigned_to', $userId)
            ->whereIn('status', ['completed', 'in_progress'])
            ->with(['property:id,title,suburb', 'submitter:id,name'])
            ->orderByDesc('updated_at')
            ->limit(50)
            ->get();

        return $jobs->map(function ($r) use ($contractorId) {
            $hasInvoice = $r->invoice()
                ->whereIn('status', ['draft', 'submitted', 'approved', 'paid'])
                ->exists();

            $quote = MaintenanceQuote::where('maintenance_request_id', $r->id)
                ->where('contractor_id', $contractorId)
                ->orderByRaw("CASE status WHEN 'accepted' THEN 1 WHEN 'sent' THEN 2 ELSE 3 END")
                ->latest('id')
                ->first();

            return [
                'id'          => $r->id,
                'title'       => $r->title,
                'property'    => trim(implode(' · ', array_filter([$r->property?->title, $r->property?->suburb]))) ?: '—',
                'tenant'      => $r->submitter?->name ?? '—',
                'status'      => $r->status,
                'has_invoice' => $hasInvoice,
                'quote'       => $quote ? [
                    'id'         => $quote->id,
                    'reference'  => 'QT-' . str_pad((string) $quote->id, 6, '0', STR_PAD_LEFT),
                    'status'     => $quote->status,
                    'subtotal'   => (float) $quote->subtotal,
                    'vat'        => (float) $quote->vat_amount,
                    'total'      => (float) $quote->total,
                    'line_items' => self::normaliseQuoteLines($quote),
                ] : null,
            ];
        })->all();
    }

    /**
     * Normalise a quote's line items into the canonical { label, qty, unit_price,
     * line_total } shape — seed data and older quotes used { desc, qty, unit }.
     * Also scales the quote's totals to match the sum of the lines so the
     * invoice baseline is internally consistent even when the seed values
     * don't add up to the recorded quote.total.
     */
    private static function normaliseQuoteLines(MaintenanceQuote $quote): array
    {
        $raw = is_array($quote->line_items) ? $quote->line_items : [];
        if (empty($raw)) return [];

        $normalised = collect($raw)->map(fn ($l) => [
            'label'      => (string) ($l['label'] ?? $l['desc'] ?? 'Line item'),
            'qty'        => (float) ($l['qty'] ?? 1),
            'unit_price' => (float) ($l['unit_price'] ?? $l['unit'] ?? 0),
        ])->all();

        $rawSubtotal = array_sum(array_map(fn ($l) => $l['qty'] * $l['unit_price'], $normalised));
        $targetSubtotal = (float) $quote->subtotal;

        // Scale to the recorded subtotal if the line math drifts (seed data fudge).
        if ($rawSubtotal > 0 && abs($rawSubtotal - $targetSubtotal) > 0.5) {
            $scale = $targetSubtotal / $rawSubtotal;
            $normalised = array_map(function ($l) use ($scale) {
                $l['unit_price'] = round($l['unit_price'] * $scale, 2);
                $l['line_total'] = round($l['qty'] * $l['unit_price'], 2);
                return $l;
            }, $normalised);
        } else {
            $normalised = array_map(function ($l) {
                $l['line_total'] = round($l['qty'] * $l['unit_price'], 2);
                return $l;
            }, $normalised);
        }

        return $normalised;
    }

    public function download(Request $request, MaintenanceInvoice $invoice, PdfService $pdf)
    {
        $contractor = $this->resolveContractor($request);
        abort_unless($invoice->contractor_id === $contractor->id, 403);

        return $pdf->maintenanceInvoice($invoice, download: $request->boolean('download'));
    }
}
