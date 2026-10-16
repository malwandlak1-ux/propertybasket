<?php

namespace App\Http\Controllers\Agency;

use App\Http\Controllers\Agency\Concerns\ResolvesAgency;
use App\Http\Controllers\Agent\CrmController as AgentCrm;
use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\CrmScheme;
use App\Models\WaCampaign;
use App\Models\WhatsAppAccount;
use App\Services\WhatsApp\WhatsAppService;
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

    /** Every agent's WhatsApp number health and campaign results (view only). */
    public function whatsapp(Request $request, WhatsAppService $wa): Response
    {
        $agency = $this->resolveAgency($request);
        [$agents, $agentId, $ids] = $this->scope($request, $agency);

        $accounts = WhatsAppAccount::where('agency_id', $agency->id)->whereIn('agent_id', $ids)->get()->keyBy('agent_id');
        $campaigns = WaCampaign::where('agency_id', $agency->id)->whereIn('agent_id', $ids)
            ->with('agent:id,name')->latest()->limit(100)->get();
        $stats = $wa->stats($campaigns->pluck('id')->all());

        return Inertia::render('Agency/Crm/WhatsApp', [
            'agency'    => ['id' => $agency->id, 'name' => $agency->name],
            'agents'    => $agents->map(fn ($a) => ['id' => $a->id, 'name' => $a->name])->values(),
            'agent_id'  => $agentId,
            'numbers'   => $agents->whereIn('id', $ids)->values()->map(function ($a) use ($accounts) {
                $acc = $accounts->get($a->id);

                return [
                    'agent'   => $a->name,
                    'phone'   => $acc?->display_phone,
                    'status'  => $acc?->status ?? 'not_connected',
                    'quality' => $acc?->quality_rating,
                    'limit'   => $acc ? min($acc->dailyLimit(), 1_000_000) : null,
                ];
            }),
            'campaigns' => $campaigns->map(function (WaCampaign $c) use ($stats) {
                $s = $stats[$c->id] ?? [];

                return [
                    'id'        => $c->id,
                    'name'      => $c->name,
                    'agent'     => $c->agent?->name,
                    'status'    => $c->status,
                    'total'     => $c->total,
                    'sent'      => ($s['sent'] ?? 0) + ($s['delivered'] ?? 0) + ($s['read'] ?? 0),
                    'delivered' => ($s['delivered'] ?? 0) + ($s['read'] ?? 0),
                    'read'      => $s['read'] ?? 0,
                    'replied'   => $s['replied'] ?? 0,
                    'failed'    => $s['failed'] ?? 0,
                    'created_at'=> $c->created_at?->format('d M Y'),
                ];
            }),
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
