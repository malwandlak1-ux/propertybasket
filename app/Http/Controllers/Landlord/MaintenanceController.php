<?php

namespace App\Http\Controllers\Landlord;

use App\Http\Controllers\Landlord\Concerns\ResolvesLandlord;
use App\Models\MaintenanceRequest;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Inertia\Inertia;
use Inertia\Response;

class MaintenanceController extends Controller
{
    use ResolvesLandlord;

    public function index(Request $request): Response
    {
        $landlord   = $this->resolveLandlord($request);
        $listingIds = $landlord->listings()->pluck('id');

        $requests = MaintenanceRequest::whereIn('property_id', $listingIds)
            ->with(['property', 'submitter', 'contractor'])
            ->orderByRaw("CASE status WHEN 'open' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'completed' THEN 3 WHEN 'paid' THEN 4 ELSE 5 END")
            ->orderByRaw("CASE urgency WHEN 'emergency' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END")
            ->orderByDesc('created_at')
            ->get();

        $grouped = [
            'open'        => [],
            'in_progress' => [],
            'completed'   => [],
            'paid'        => [],
        ];

        foreach ($requests as $req) {
            $key = match ($req->status) {
                'open'        => 'open',
                'in_progress' => 'in_progress',
                'completed'   => 'completed',
                'paid'        => 'paid',
                default       => 'open',
            };

            $grouped[$key][] = [
                'id'           => $req->id,
                'title'        => $req->title,
                'description'  => $req->description,
                'category'     => $req->category,
                'urgency'      => $req->urgency,
                'status'       => $req->status,
                'property'     => $req->property?->suburb,
                'tenant_name'  => $req->submitter?->name,
                'contractor'   => $req->contractor?->name,
                'photos_count' => count($req->photos ?? []),
                'created_at'   => $req->created_at?->diffForHumans(),
                'completed_at' => $req->completed_at?->format('d M Y'),
            ];
        }

        return Inertia::render('Landlord/Maintenance', [
            'landlord' => ['id' => $landlord->id, 'name' => $request->user()->name],
            'grouped'  => $grouped,
            'counts'   => array_map('count', $grouped),
        ]);
    }
}
