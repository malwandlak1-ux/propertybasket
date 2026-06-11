<?php

namespace App\Http\Controllers\Agent;

use App\Http\Controllers\Agency\MaintenanceController as AgencyMaintenance;
use App\Http\Controllers\Agent\Concerns\ResolvesAgent;
use App\Http\Controllers\Controller;
use App\Models\MaintenanceRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MaintenanceController extends Controller
{
    use ResolvesAgent;

    /**
     * GET /agent/maintenance — maintenance requests on the agent's leases,
     * with the same quote-request / marketplace actions the agency has.
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
            ->map(fn ($r) => AgencyMaintenance::mapRequest($r));

        return Inertia::render('Agent/Maintenance', [
            'agent'       => ['id' => $user->id, 'name' => $user->name, 'agency_name' => $agentRecord->agency->name],
            'requests'    => $requests,
            'contractors' => AgencyMaintenance::contractorPickers($agentRecord->agency_id),
            'base_url'    => '/agent/maintenance',
        ]);
    }

    /**
     * POST /agent/maintenance/{maintenanceRequest}/assign — request a quote
     * from a specific contractor (agency roster or marketplace).
     */
    public function assign(Request $request, MaintenanceRequest $maintenanceRequest): RedirectResponse
    {
        $user        = $request->user();
        $agentRecord = $this->resolveAgentRecord($request);
        $this->authoriseForAgent($maintenanceRequest, $user->id);

        return AgencyMaintenance::assignContractor($request, $maintenanceRequest, $agentRecord->agency_id);
    }

    /**
     * POST /agent/maintenance/{maintenanceRequest}/marketplace
     */
    public function marketplace(Request $request, MaintenanceRequest $maintenanceRequest): RedirectResponse
    {
        $user = $request->user();
        $this->resolveAgentRecord($request);
        $this->authoriseForAgent($maintenanceRequest, $user->id);

        $maintenanceRequest->update(['assigned_to' => null, 'status' => 'open']);

        return back()->with('success', 'Job posted to the contractor marketplace — area contractors can now quote on it.');
    }

    private function authoriseForAgent(MaintenanceRequest $r, int $agentUserId): void
    {
        $r->loadMissing('lease');
        abort_unless(
            $r->lease?->agent_id === $agentUserId,
            403,
            'You can only manage maintenance on your own leases.',
        );
    }
}
