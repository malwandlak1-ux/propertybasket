<?php

namespace App\Http\Controllers\Agency;

use App\Http\Controllers\Agency\Concerns\ResolvesAgency;
use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\Contractor;
use App\Models\ContractorRating;
use App\Models\Listing;
use App\Models\MaintenanceRequest;
use App\Notifications\MaintenanceJobAssigned;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MaintenanceController extends Controller
{
    use ResolvesAgency;

    /**
     * GET /agency/maintenance — every maintenance request on the agency's
     * properties, with allocation actions.
     */
    public function index(Request $request): Response
    {
        $agency = $this->resolveAgency($request);

        $propertyIds = Listing::where('owner_type', Agency::class)
            ->where('owner_id', $agency->id)
            ->pluck('id');

        $requests = MaintenanceRequest::whereIn('property_id', $propertyIds)
            ->with(['property:id,title,suburb,city', 'submitter:id,name,phone', 'contractor:id,name'])
            ->withCount('quotes')
            ->orderByRaw("CASE urgency WHEN 'emergency' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END")
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($r) => self::mapRequest($r, $request->user()->id));

        return Inertia::render('Agency/Maintenance', [
            'agency'      => ['id' => $agency->id, 'name' => $agency->name],
            'requests'    => $requests,
            'contractors' => self::contractorPickers($agency->id),
            'base_url'    => '/agency/maintenance',
            'quotes_url'  => '/agency/maintenance/quotes',
        ]);
    }

    /**
     * POST /agency/maintenance/{maintenanceRequest}/assign
     * Allocate the job to a specific contractor (private roster or
     * marketplace) — i.e. request a quotation from them.
     */
    public function assign(Request $request, MaintenanceRequest $maintenanceRequest): RedirectResponse
    {
        $agency = $this->resolveAgency($request);
        self::authoriseForAgency($maintenanceRequest, $agency);

        return self::assignContractor($request, $maintenanceRequest, $agency->id);
    }

    /**
     * POST /agency/maintenance/{maintenanceRequest}/marketplace
     * Open the job to all matching contractors on the marketplace.
     */
    public function marketplace(Request $request, MaintenanceRequest $maintenanceRequest): RedirectResponse
    {
        $agency = $this->resolveAgency($request);
        self::authoriseForAgency($maintenanceRequest, $agency);

        $maintenanceRequest->update(['assigned_to' => null, 'status' => 'open']);

        return back()->with('success', 'Job posted to the contractor marketplace — area contractors can now quote on it.');
    }

    /**
     * POST /agency/maintenance/{maintenanceRequest}/rate — rate the
     * contractor on a completed job.
     */
    public function rate(Request $request, MaintenanceRequest $maintenanceRequest): RedirectResponse
    {
        $agency = $this->resolveAgency($request);
        self::authoriseForAgency($maintenanceRequest, $agency);

        return self::applyRating($request, $maintenanceRequest);
    }

    // ── Shared helpers (also used by Agent/Tenant controllers) ───────────

    /**
     * Validate + persist a contractor rating for a completed job, then
     * recompute the contractor's aggregate score. One rating per user per
     * job (re-rating updates it).
     */
    public static function applyRating(Request $request, MaintenanceRequest $maintenanceRequest): RedirectResponse
    {
        abort_unless(
            in_array($maintenanceRequest->status, ['completed', 'paid'], true),
            422,
            'You can only rate the contractor once the job is completed.',
        );
        abort_if(
            $maintenanceRequest->assigned_to === null,
            422,
            'No contractor was assigned to this job.',
        );

        $data = $request->validate([
            'rating'  => ['required', 'integer', 'min:1', 'max:5'],
            'comment' => ['nullable', 'string', 'max:1000'],
        ]);

        $contractor = Contractor::where('user_id', $maintenanceRequest->assigned_to)
            ->latest('id')
            ->first();
        abort_if($contractor === null, 422, 'The assigned contractor no longer exists.');

        ContractorRating::updateOrCreate(
            [
                'contractor_id'          => $contractor->id,
                'rated_by'               => $request->user()->id,
                'maintenance_request_id' => $maintenanceRequest->id,
            ],
            [
                'rating'  => $data['rating'],
                'comment' => $data['comment'] ?? null,
            ],
        );

        // Recompute the aggregate from the source of truth.
        $contractor->update([
            'average_rating' => round((float) ContractorRating::where('contractor_id', $contractor->id)->avg('rating'), 2),
            'total_reviews'  => ContractorRating::where('contractor_id', $contractor->id)->count(),
        ]);

        return back()->with('success', 'Thanks — your rating has been recorded.');
    }

    public static function mapRequest(MaintenanceRequest $r, ?int $forUserId = null): array
    {
        $photos = array_values(array_filter(array_map(
            fn ($p) => is_string($p) ? $p : ($p['url'] ?? ''),
            is_array($r->photos) ? $r->photos : [],
        )));

        $stage = match (true) {
            in_array($r->status, ['completed', 'paid']) => 'done',
            $r->status === 'in_progress'                => 'in_progress',
            $r->assigned_to !== null                    => 'allocated',
            default                                     => 'new',
        };

        $myRating = null;
        if ($forUserId && $stage === 'done' && $r->assigned_to) {
            $myRating = ContractorRating::where('maintenance_request_id', $r->id)
                ->where('rated_by', $forUserId)
                ->value('rating');
        }

        return [
            'my_rating'   => $myRating,
            'can_rate'    => $stage === 'done' && $r->assigned_to !== null,
            'id'          => $r->id,
            'title'       => $r->title,
            'description' => $r->description,
            'category'    => $r->category,
            'urgency'     => $r->urgency,
            'status'      => $r->status,
            'stage'       => $stage,
            'photos'      => $photos,
            'photo_count' => count($photos),
            'tenant'      => $r->submitter?->name ?? '—',
            'tenant_phone'=> $r->submitter?->phone,
            'property'    => $r->property?->title ?? '—',
            'suburb'      => $r->property?->suburb,
            'preferred'   => $r->preferred_date?->format('d M Y'),
            'time_slot'   => $r->preferred_time_slot,
            'contractor'  => $r->contractor?->name,
            'quote_count' => (int) ($r->quotes_count ?? 0),
            'created'     => $r->created_at?->diffForHumans(),
        ];
    }

    public static function contractorPickers(int $agencyId): array
    {
        $map = fn (Contractor $c) => [
            'id'             => $c->id,
            'business_name'  => $c->business_name,
            'contact_name'   => $c->user?->name,
            'specialities'   => is_array($c->specialities) ? $c->specialities : [],
            'service_areas'  => is_array($c->service_areas) ? $c->service_areas : [],
            'average_rating' => (float) $c->average_rating,
            'total_jobs'     => (int) $c->total_jobs,
        ];

        return [
            'mine' => Contractor::with('user:id,name')
                ->where('created_by_agency_id', $agencyId)
                ->where('status', 'active')
                ->orderByDesc('average_rating')
                ->get()->map($map)->values()->all(),
            'market' => Contractor::with('user:id,name')
                ->whereNull('created_by_agency_id')
                ->where('status', 'active')
                ->orderByDesc('average_rating')
                ->orderByDesc('total_jobs')
                ->limit(50)
                ->get()->map($map)->values()->all(),
        ];
    }

    public static function assignContractor(Request $request, MaintenanceRequest $maintenanceRequest, int $agencyId): RedirectResponse
    {
        $data = $request->validate([
            'contractor_id' => ['required', 'integer', 'exists:contractors,id'],
        ]);

        $contractor = Contractor::with('user:id,name')->findOrFail($data['contractor_id']);

        // Only the agency's own roster or public marketplace contractors.
        abort_unless(
            $contractor->created_by_agency_id === null || $contractor->created_by_agency_id === $agencyId,
            403,
            'That contractor belongs to another agency.',
        );

        $maintenanceRequest->update([
            'assigned_to' => $contractor->user_id,
            'status'      => 'open',
        ]);

        if ($contractor->user) {
            try {
                $contractor->user->notify(new MaintenanceJobAssigned($maintenanceRequest->fresh('property')));
            } catch (\Throwable $e) {
                report($e);
            }
        }

        $name = $contractor->business_name ?? $contractor->user?->name ?? 'the contractor';

        return back()->with('success', "Quote requested from {$name} — the job is now in their queue.");
    }

    private static function authoriseForAgency(MaintenanceRequest $r, Agency $agency): void
    {
        $r->loadMissing('property');
        abort_unless(
            $r->property?->owner_type === Agency::class && $r->property->owner_id === $agency->id,
            403,
            'You can only manage maintenance on your agency\'s properties.',
        );
    }
}
