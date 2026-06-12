<?php

namespace App\Http\Controllers\Agent;

use App\Http\Controllers\Agency\MaintenanceController as AgencyMaintenance;
use App\Http\Controllers\Agent\Concerns\ResolvesAgent;
use App\Http\Controllers\Controller;
use App\Models\MaintenanceRequest;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MaintenanceController extends Controller
{
    use ResolvesAgent;

    /**
     * GET /agent/maintenance — read-only view of maintenance requests on the
     * agent's leases. Contractor allocation is an agency-only action; agents
     * follow the workflow (allocation → quotes → progress → completion) here.
     */
    public function index(Request $request): Response
    {
        $user        = $request->user();
        $agentRecord = $this->resolveAgentRecord($request);

        $requests = MaintenanceRequest::whereHas('lease', fn ($q) => $q->where('agent_id', $user->id))
            ->with(['property:id,title,suburb,city', 'submitter:id,name,phone', 'contractor:id,name'])
            ->withCount('quotes')
            ->orderByRaw("CASE urgency WHEN 'emergency' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END")
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($r) => AgencyMaintenance::mapRequest($r, $user->id));

        return Inertia::render('Agent/Maintenance', [
            'agent'    => ['id' => $user->id, 'name' => $user->name, 'agency_name' => $agentRecord->agency->name],
            'requests' => $requests,
            'base_url' => '/agent/maintenance',
        ]);
    }
}
