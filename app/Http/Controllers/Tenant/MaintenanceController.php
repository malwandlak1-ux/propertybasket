<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Tenant\Concerns\ResolvesTenant;
use App\Models\Agency;
use App\Models\MaintenanceRequest;
use App\Notifications\MaintenanceRequestSubmitted;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class MaintenanceController extends Controller
{
    use ResolvesTenant;

    public function index(Request $request): Response
    {
        $lease = $this->resolveLease($request);
        $user  = $request->user();

        $requests = MaintenanceRequest::where('lease_id', $lease->id)
            ->with('contractor:id,name')
            ->orderByDesc('created_at')
            ->get()
            ->map(function (MaintenanceRequest $r) {
                return [
                    'id'           => $r->id,
                    'title'        => $r->title,
                    'description'  => $r->description,
                    'category'     => $r->category,
                    'urgency'      => $r->urgency,
                    'status'       => $r->status,
                    'logged_at'    => $r->created_at?->format('d M Y'),
                    'completed_at' => $r->completed_at?->format('d M Y'),
                    'photo_count'  => is_array($r->photos) ? count($r->photos) : 0,
                    'contractor'   => $r->contractor ? [
                        'name'     => $r->contractor->name,
                        'initials' => collect(explode(' ', $r->contractor->name))->take(2)->map(fn ($w) => mb_substr($w, 0, 1))->implode(''),
                    ] : null,
                    'preferred_date' => $r->preferred_date?->format('d M Y'),
                    'preferred_slot' => $r->preferred_time_slot,
                ];
            });

        $active = $requests->filter(fn ($r) => ! in_array($r['status'], ['completed', 'paid']))->values();
        $past   = $requests->filter(fn ($r) => in_array($r['status'], ['completed', 'paid']))->values();

        return Inertia::render('Tenant/Maintenance', [
            'tenant' => [
                'id'   => $user->id,
                'name' => $user->name,
            ],
            'lease' => [
                'id'      => $lease->id,
                'address' => $lease->listing?->address ?? $lease->listing?->title ?? '',
            ],
            'active' => $active,
            'past'   => $past,
        ]);
    }

    public function store(Request $request): \Illuminate\Http\RedirectResponse
    {
        $lease = $this->resolveLease($request);
        $user  = $request->user();

        $data = $request->validate([
            'title'                => 'required|string|max:200',
            'description'          => 'required|string|max:2000',
            'category'             => 'required|in:plumbing,electrical,appliances,structural,garden,other',
            'urgency'              => 'required|in:low,medium,high,emergency',
            'preferred_date'       => 'nullable|date',
            'preferred_time_slot'  => 'nullable|string|max:60',
            'photos'               => 'nullable|array|max:8',
            'photos.*'             => 'image|max:8192', // 8 MB per photo (phone cameras)
        ]);

        // Store uploaded photos to the public disk; the contractor + agency
        // views read these URLs straight from the photos JSON.
        $photoUrls = [];
        foreach ($request->file('photos') ?? [] as $photo) {
            $photoUrls[] = Storage::url($photo->store('maintenance', 'public'));
        }

        $req = MaintenanceRequest::create([
            'property_id'         => $lease->listing_id,
            'lease_id'            => $lease->id,
            'submitted_by'        => $user->id,
            'title'               => $data['title'],
            'description'         => $data['description'],
            'category'            => $data['category'],
            'urgency'             => $data['urgency'],
            'preferred_date'      => $data['preferred_date'] ?? null,
            'preferred_time_slot' => $data['preferred_time_slot'] ?? null,
            'photos'              => $photoUrls,
            'status'              => 'open',
        ]);

        // Notify the managing parties: assigned agent, agency owner, landlord.
        $recipients = [];
        if ($lease->agent_id && ($agent = \App\Models\User::find($lease->agent_id))) {
            $recipients[] = $agent;
        }
        if ($lease->agency_id && ($agencyOwner = Agency::find($lease->agency_id)?->owner)) {
            $recipients[] = $agencyOwner;
        }
        if ($lease->landlord_id && ($landlord = \App\Models\User::find($lease->landlord_id))) {
            $recipients[] = $landlord;
        }
        // De-duplicate (the agency owner can also be the assigned agent).
        $recipients = collect($recipients)->unique('id')->values()->all();
        if (! empty($recipients)) {
            Notification::send($recipients, new MaintenanceRequestSubmitted($req));
        }

        return back();
    }
}
