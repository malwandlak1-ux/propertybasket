<?php

namespace App\Http\Controllers\Agency;

use App\Http\Controllers\Agency\Concerns\ResolvesAgency;
use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\Listing;
use App\Models\MaintenanceQuote;
use App\Services\MaintenanceWorkflow;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class QuotesController extends Controller
{
    use ResolvesAgency;

    /**
     * GET /agency/maintenance/quotes — pending quotes on the agency's
     * maintenance requests, waiting for accept/reject.
     */
    public function index(Request $request): Response
    {
        $agency = $this->resolveAgency($request);

        $propertyIds = Listing::where('owner_type', Agency::class)
            ->where('owner_id', $agency->id)
            ->pluck('id');

        $quotes = MaintenanceQuote::whereIn('status', ['sent', 'accepted', 'rejected'])
            ->whereHas('request', fn ($q) => $q->whereIn('property_id', $propertyIds))
            ->with(['request.property:id,title,suburb,city', 'request.submitter:id,name', 'contractor.user:id,name'])
            ->orderByDesc('updated_at')
            ->limit(50)
            ->get()
            ->map(fn ($q) => [
                'id'              => $q->id,
                'reference'       => 'QT-' . str_pad((string) $q->id, 6, '0', STR_PAD_LEFT),
                'job_id'          => $q->maintenance_request_id,
                'job_title'       => $q->request?->title ?? '—',
                'property'        => $q->request?->property?->title ?? '—',
                'property_suburb' => $q->request?->property?->suburb,
                'tenant'          => $q->request?->submitter?->name ?? '—',
                'contractor'      => $q->contractor?->business_name ?? $q->contractor?->user?->name ?? '—',
                'subtotal'        => (float) $q->subtotal,
                'vat'             => (float) $q->vat_amount,
                'total'           => (float) $q->total,
                'status'          => $q->status,
                'sent_at'         => $q->sent_at?->format('d M Y'),
                'expires_at'      => $q->expires_at?->format('d M Y'),
                'line_count'      => is_array($q->line_items) ? count($q->line_items) : 0,
            ]);

        return Inertia::render('Agency/MaintenanceQuotes', [
            'agency' => ['id' => $agency->id, 'name' => $agency->name],
            'quotes' => $quotes,
        ]);
    }

    /**
     * POST /agency/maintenance/quotes/{quote}/accept — approve a contractor
     * quote so they can schedule and start the job. Any other quote on the
     * same job is automatically rejected.
     */
    public function accept(Request $request, MaintenanceQuote $quote): RedirectResponse
    {
        $agency = $this->resolveAgency($request);
        $this->authoriseQuoteForAgency($quote, $agency);

        abort_unless(
            $quote->status === 'sent',
            422,
            'Only quotes that are awaiting review can be accepted.',
        );

        app(MaintenanceWorkflow::class)->acceptQuote($quote);

        return back()->with('success', "Quote {$this->ref($quote)} accepted — the contractor can now schedule the job.");
    }

    /**
     * POST /agency/maintenance/quotes/{quote}/reject
     */
    public function reject(Request $request, MaintenanceQuote $quote): RedirectResponse
    {
        $agency = $this->resolveAgency($request);
        $this->authoriseQuoteForAgency($quote, $agency);

        abort_unless(
            $quote->status === 'sent',
            422,
            'Only quotes awaiting review can be rejected.',
        );

        app(MaintenanceWorkflow::class)->rejectQuote($quote);

        return back()->with('success', "Quote {$this->ref($quote)} rejected.");
    }

    private function authoriseQuoteForAgency(MaintenanceQuote $quote, Agency $agency): void
    {
        $quote->loadMissing('request.property');
        abort_unless(
            $quote->request?->property?->owner_type === Agency::class
                && $quote->request->property->owner_id === $agency->id,
            403,
            'You can only review quotes on jobs at your agency.',
        );
    }

    private function ref(MaintenanceQuote $q): string
    {
        return 'QT-' . str_pad((string) $q->id, 6, '0', STR_PAD_LEFT);
    }
}
