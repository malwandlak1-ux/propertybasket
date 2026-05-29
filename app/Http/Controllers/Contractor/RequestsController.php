<?php

namespace App\Http\Controllers\Contractor;

use App\Http\Controllers\Contractor\Concerns\ResolvesContractor;
use App\Models\MaintenanceQuote;
use App\Models\MaintenanceRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Inertia\Inertia;
use Inertia\Response;

class RequestsController extends Controller
{
    use ResolvesContractor;

    public function index(Request $request): Response
    {
        $contractor = $this->resolveContractor($request);
        $userId     = $contractor->user_id;

        $assigned = MaintenanceRequest::where('assigned_to', $userId)
            ->where('status', 'open')
            ->with(['property', 'submitter'])
            ->orderByRaw("CASE urgency WHEN 'emergency' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END")
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($r) => $this->mapRequest($r, 'assigned', $contractor->id));

        $specialities = $contractor->specialities ?? [];
        $marketplaceQ = MaintenanceRequest::whereNull('assigned_to')
            ->where('status', 'open');
        if (! empty($specialities)) {
            $marketplaceQ->whereIn('category', $specialities);
        }
        $marketplace = $marketplaceQ
            ->with(['property', 'submitter'])
            ->orderByRaw("CASE urgency WHEN 'emergency' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END")
            ->orderByDesc('created_at')
            ->limit(20)
            ->get()
            ->map(fn ($r) => $this->mapRequest($r, 'marketplace', $contractor->id));

        return Inertia::render('Contractor/Requests', [
            'counts'         => $this->sidebarCounts($contractor),
            'assigned'       => $assigned->values(),
            'marketplace'    => $marketplace->values(),
            'specialities'   => $specialities,
            'vat_registered' => (bool) $contractor->vat_registered,
            'vat_rate'       => 15.0,
        ]);
    }

    /**
     * POST /contractor/requests/{maintenanceRequest}/accept
     * - From the marketplace: claim the job (self-assign).
     * - From "assigned": "schedule" the job → only allowed once the agency has
     *   accepted at least one quote on it.
     */
    public function accept(Request $request, MaintenanceRequest $maintenanceRequest): RedirectResponse
    {
        $contractor = $this->resolveContractor($request);

        $isAlreadyAssigned = $maintenanceRequest->assigned_to === $contractor->user_id;

        if ($isAlreadyAssigned) {
            // "Schedule" path — gate behind an accepted quote
            $hasAccepted = MaintenanceQuote::where('maintenance_request_id', $maintenanceRequest->id)
                ->where('contractor_id', $contractor->id)
                ->where('status', 'accepted')
                ->exists();

            abort_unless(
                $hasAccepted,
                422,
                'Submit a quote and wait for the agency to accept it before scheduling.',
            );

            $maintenanceRequest->update(['status' => 'in_progress']);

            return back()->with('success', 'Job scheduled — moved to In Progress.');
        }

        // Marketplace claim — self-assign. Quote must follow before scheduling.
        $maintenanceRequest->update([
            'assigned_to' => $contractor->user_id,
            'status'      => 'open',
        ]);

        return back()->with('success', 'Job accepted. Submit a quote so the agency can approve it.');
    }

    public function decline(Request $request, MaintenanceRequest $maintenanceRequest): RedirectResponse
    {
        $this->resolveContractor($request);

        $maintenanceRequest->update(['assigned_to' => null]);

        return back()->with('success', 'Job declined and returned to marketplace.');
    }

    private function mapRequest(MaintenanceRequest $r, string $kind, int $contractorId): array
    {
        // Latest quote from this contractor on this job (any status).
        $myQuote = MaintenanceQuote::where('maintenance_request_id', $r->id)
            ->where('contractor_id', $contractorId)
            ->latest('id')
            ->first();

        $stage = $kind === 'marketplace'
            ? 'marketplace'
            : ($myQuote === null
                ? 'needs_quote'
                : ($myQuote->status === 'accepted'
                    ? 'quote_accepted'
                    : ($myQuote->status === 'rejected'
                        ? 'quote_rejected'
                        : 'awaiting_approval')));

        $rawPhotos = is_array($r->photos) ? $r->photos : [];
        $photos = array_map(function ($p) {
            // Photos can be a stored URL or a plain path string.
            return is_string($p) ? $p : ($p['url'] ?? '');
        }, $rawPhotos);
        $photos = array_values(array_filter($photos));

        return [
            'id'          => $r->id,
            'kind'        => $kind,
            'title'       => $r->title,
            'description' => $r->description,
            'category'    => $r->category,
            'urgency'     => $r->urgency,
            'property'    => $r->property?->suburb ?? '—',
            'property_title' => $r->property?->title,
            'address'     => $r->property?->address ?? null,
            'tenant'      => $r->submitter?->name ?? '—',
            'tenant_email'=> $r->submitter?->email,
            'tenant_phone'=> $r->submitter?->phone,
            'preferred'   => $r->preferred_date?->format('d M Y'),
            'time_slot'   => $r->preferred_time_slot,
            'photos'      => $photos,
            'photo_count' => count($photos),
            'created'     => $r->created_at?->diffForHumans(),
            'stage'       => $stage,
            'my_quote'    => $myQuote ? [
                'id'         => $myQuote->id,
                'reference'  => 'QT-' . str_pad((string) $myQuote->id, 6, '0', STR_PAD_LEFT),
                'status'     => $myQuote->status,
                'subtotal'   => (float) $myQuote->subtotal,
                'vat'        => (float) $myQuote->vat_amount,
                'total'      => (float) $myQuote->total,
                'sent_at'    => $myQuote->sent_at?->format('d M Y'),
                'expires_at' => $myQuote->expires_at?->format('d M Y'),
            ] : null,
        ];
    }
}
