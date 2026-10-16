<?php

namespace App\Http\Controllers\Agency;

use App\Http\Controllers\Agency\Concerns\ResolvesAgency;
use App\Http\Controllers\Agent\CrmController as AgentCrm;
use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\CrmScheme;
use App\Services\CrmService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Agency CRM: a read-only view over every agent's farming and outreach,
 * filterable to one agent. Agents own and edit their records.
 */
class CrmController extends Controller
{
    use ResolvesAgency;

    public function __construct(private CrmService $crm) {}

    public function overview(Request $request): Response
    {
        $agency = $this->resolveAgency($request);
        [$agents, $agentId, $ids] = $this->scope($request, $agency);
        $days = in_array((int) $request->query('range', 30), [7, 30, 90], true) ? (int) $request->query('range', 30) : 30;

        return Inertia::render('Agency/Crm/Overview', [
            'agency'      => ['id' => $agency->id, 'name' => $agency->name],
            'agents'      => $agents->map(fn ($a) => ['id' => $a->id, 'name' => $a->name])->values(),
            'agent_id'    => $agentId,
            'data'        => $this->crm->overview($agency->id, $ids, $days),
            'leaderboard' => $this->crm->leaderboard($agency->id, $agentId ? $agents->where('id', $agentId)->values() : $agents, $days),
        ]);
    }

    public function farming(Request $request): Response
    {
        $agency = $this->resolveAgency($request);
        [$agents, $agentId, $ids] = $this->scope($request, $agency);
        $q = $request->validate([
            'region' => ['nullable', 'integer'],
            'suburb' => ['nullable', 'integer'],
            'scheme' => ['nullable', 'integer'],
        ]);

        return Inertia::render('Agency/Crm/Farming', [
            'agency'   => ['id' => $agency->id, 'name' => $agency->name],
            'agents'   => $agents->map(fn ($a) => ['id' => $a->id, 'name' => $a->name])->values(),
            'agent_id' => $agentId,
            'farm'     => $this->crm->farming($agency->id, $ids, $q['region'] ?? null, $q['suburb'] ?? null, $q['scheme'] ?? null),
        ]);
    }

    public function exportProspects(Request $request, CrmScheme $scheme): StreamedResponse
    {
        $agency = $this->resolveAgency($request);
        abort_unless($scheme->agency_id === $agency->id, 403);

        return AgentCrm::csv($scheme);
    }

    /** [all agents, selected agent id|null, agent ids in scope] */
    private function scope(Request $request, Agency $agency): array
    {
        $agents = $agency->agents()->select('users.id', 'users.name')->orderBy('name')->get();
        $agentId = (int) $request->query('agent') ?: null;
        if ($agentId && ! $agents->contains('id', $agentId)) {
            $agentId = null;
        }

        return [$agents, $agentId, $agentId ? [$agentId] : $agents->pluck('id')->all()];
    }
}
