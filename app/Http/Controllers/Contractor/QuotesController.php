<?php

namespace App\Http\Controllers\Contractor;

use App\Http\Controllers\Contractor\Concerns\ResolvesContractor;
use App\Models\MaintenanceQuote;
use App\Models\MaintenanceRequest;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class QuotesController extends Controller
{
    use ResolvesContractor;

    public function index(Request $request): Response
    {
        $contractor = $this->resolveContractor($request);

        $filter = $request->string('filter', 'all')->toString();

        $query = MaintenanceQuote::where('contractor_id', $contractor->id)
            ->with(['request.property', 'request.submitter'])
            ->orderByDesc('updated_at');

        if (in_array($filter, ['draft', 'sent', 'accepted', 'expired', 'rejected'], true)) {
            $query->where('status', $filter);
        }

        $quotes = $query->limit(50)->get()->map(function ($q) {
            $lineItems = is_array($q->line_items) ? $q->line_items : [];
            return [
                'id'             => $q->id,
                'reference'      => 'QT-' . str_pad((string) $q->id, 6, '0', STR_PAD_LEFT),
                'title'          => $q->request?->title ?? 'Quote',
                'agency'         => optional($q->request?->property?->owner)->name ?? '—',
                'tenant'         => $q->request?->submitter?->name ?? '—',
                'property'       => $q->request?->property?->suburb ?? '—',
                'status'         => $q->status,
                'subtotal'       => (float) $q->subtotal,
                'vat'            => (float) $q->vat_amount,
                'total'          => (float) $q->total,
                'vat_registered' => (bool) $q->vat_registered,
                'line_count'     => count($lineItems),
                'sent_at'        => $q->sent_at?->format('d M Y'),
                'expires_at'     => $q->expires_at?->format('d M Y'),
                'expires_soon'   => $q->expires_at && $q->expires_at->diffInDays(now(), false) > -3 && $q->status === 'sent',
                'updated'        => $q->updated_at?->diffForHumans(),
            ];
        });

        $counts = [
            'all'       => MaintenanceQuote::where('contractor_id', $contractor->id)->count(),
            'draft'     => MaintenanceQuote::where('contractor_id', $contractor->id)->where('status', 'draft')->count(),
            'sent'      => MaintenanceQuote::where('contractor_id', $contractor->id)->where('status', 'sent')->count(),
            'accepted'  => MaintenanceQuote::where('contractor_id', $contractor->id)->where('status', 'accepted')->count(),
            'rejected'  => MaintenanceQuote::where('contractor_id', $contractor->id)->where('status', 'rejected')->count(),
            'expired'   => MaintenanceQuote::where('contractor_id', $contractor->id)->where('status', 'expired')->count(),
        ];

        return Inertia::render('Contractor/Quotes', [
            'counts'         => $this->sidebarCounts($contractor),
            'quotes'         => $quotes->values(),
            'filter'         => $filter,
            'tab_counts'     => $counts,
            'quotable_jobs'  => $this->quotableJobs($contractor->user_id),
            'vat_registered' => (bool) $contractor->vat_registered,
            'vat_rate'       => 15.0,
        ]);
    }

    /**
     * POST /contractor/quotes — create + send a quote against one of the
     * contractor's assigned jobs.
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
            'notes'                  => ['nullable', 'string', 'max:2000'],
            'valid_until'            => ['nullable', 'date', 'after_or_equal:today'],
            'status'                 => ['nullable', Rule::in(['draft', 'sent'])],
        ]);

        $req = MaintenanceRequest::findOrFail($data['maintenance_request_id']);
        abort_unless(
            $req->assigned_to === $contractor->user_id,
            403,
            'You can only quote on jobs assigned to you.',
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
        $subtotal = round($subtotal, 2);

        $vatRegistered = (bool) $contractor->vat_registered;
        $vatAmount     = $vatRegistered ? round($subtotal * 0.15, 2) : 0.0;
        $total         = round($subtotal + $vatAmount, 2);

        $status     = $data['status'] ?? 'sent';
        $validUntil = isset($data['valid_until'])
            ? CarbonImmutable::parse($data['valid_until'])
            : CarbonImmutable::now()->addDays(14);

        MaintenanceQuote::create([
            'maintenance_request_id' => $req->id,
            'contractor_id'          => $contractor->id,
            'line_items'             => $lineItems,
            'subtotal'               => $subtotal,
            'vat_amount'             => $vatAmount,
            'total'                  => $total,
            'vat_registered'         => $vatRegistered,
            'notes'                  => $data['notes'] ?? null,
            'valid_until'            => $validUntil,
            'status'                 => $status,
            'sent_at'                => $status === 'sent' ? now() : null,
            'expires_at'             => $status === 'sent' ? $validUntil : null,
        ]);

        return redirect()
            ->route('contractor.quotes.index', ['filter' => $status])
            ->with('success', $status === 'sent'
                ? "Quote sent for \"{$req->title}\" — total R" . number_format($total, 2) . '.'
                : "Draft quote saved for \"{$req->title}\".");
    }

    private function quotableJobs(int $userId): array
    {
        return MaintenanceRequest::where('assigned_to', $userId)
            ->whereIn('status', ['open', 'in_progress', 'completed'])
            ->with(['property:id,title,suburb,city', 'submitter:id,name'])
            ->orderByDesc('updated_at')
            ->limit(50)
            ->get()
            ->map(fn ($r) => [
                'id'        => $r->id,
                'title'     => $r->title,
                'property'  => trim(implode(' · ', array_filter([
                    $r->property?->title,
                    $r->property?->suburb,
                ]))) ?: '—',
                'tenant'    => $r->submitter?->name ?? '—',
                'status'    => $r->status,
                'urgency'   => $r->urgency ?? null,
                'has_quote' => $r->quotes()->whereIn('status', ['draft', 'sent', 'accepted'])->exists(),
            ])
            ->all();
    }
}
