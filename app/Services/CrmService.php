<?php

namespace App\Services;

use App\Models\CrmActivity;
use App\Models\CrmProspect;
use App\Models\CrmRegion;
use App\Models\CrmScheme;
use App\Models\CrmSuburb;
use App\Models\Inquiry;
use App\Models\User;
use App\Support\Crm;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Read side of the CRM, shared by the agent view (their own records) and the
 * agency view (every agent's records, optionally filtered to one agent).
 * Every query is scoped by agency + a list of agent ids.
 */
class CrmService
{
    /**
     * Outreach statistics for the CRM overview.
     *
     * @param  int[]  $agentIds
     */
    public function overview(int $agencyId, array $agentIds, int $days): array
    {
        $today    = CarbonImmutable::today();
        $from     = $today->subDays($days - 1);
        $prevFrom = $from->subDays($days);
        $prevTo   = $from->subDay();

        $acts = fn () => CrmActivity::query()->where('agency_id', $agencyId)->whereIn('agent_id', $agentIds);

        // ── Per-channel stats for the period ─────────────────────────────
        $connected = $this->inList(Crm::CONNECTED);
        $positive  = $this->inList(Crm::POSITIVE);
        $byChannel = $acts()
            ->whereDate('occurred_on', '>=', $from->toDateString())->whereDate('occurred_on', '<=', $today->toDateString())
            ->groupBy('channel')
            ->selectRaw("channel,
                SUM(quantity) AS attempts,
                SUM(CASE WHEN outcome IN ($connected) THEN quantity ELSE 0 END) AS connected,
                SUM(CASE WHEN outcome IN ($positive) THEN quantity ELSE 0 END) AS positive,
                SUM(CASE WHEN outcome = 'appointment' THEN quantity ELSE 0 END) AS appointments")
            ->get()
            ->keyBy('channel');

        $channels = collect(Crm::CHANNELS)->map(function ($label, $key) use ($byChannel) {
            $row = $byChannel->get($key);
            $attempts = (int) ($row->attempts ?? 0);
            $conn = (int) ($row->connected ?? 0);

            return [
                'key'          => $key,
                'label'        => $label,
                'attempts'     => $attempts,
                'connected'    => $conn,
                'positive'     => (int) ($row->positive ?? 0),
                'appointments' => (int) ($row->appointments ?? 0),
                'connect_rate' => $attempts > 0 ? round($conn / $attempts * 100) : 0,
            ];
        })->values();

        // ── Daily touches, this period vs the previous one ───────────────
        $daily = fn ($start, $end) => $acts()
            ->whereDate('occurred_on', '>=', $start->toDateString())->whereDate('occurred_on', '<=', $end->toDateString())
            ->groupBy('occurred_on')
            ->selectRaw('occurred_on, SUM(quantity) AS n')
            ->pluck('n', 'occurred_on')
            ->mapWithKeys(fn ($n, $d) => [substr((string) $d, 0, 10) => (int) $n]);

        $cur  = $daily($from, $today);
        $prev = $daily($prevFrom, $prevTo);
        $labels = $series = $previous = [];
        for ($i = 0; $i < $days; $i++) {
            $d = $from->addDays($i);
            $labels[]   = $d->format('d M');
            $series[]   = $cur[$d->toDateString()] ?? 0;
            $previous[] = $prev[$prevFrom->addDays($i)->toDateString()] ?? 0;
        }

        // ── Prospect funnel + headline numbers ────────────────────────────
        $prospects = fn () => CrmProspect::query()->where('agency_id', $agencyId)->whereIn('agent_id', $agentIds);
        $statusCounts = $prospects()->groupBy('status')->selectRaw('status, COUNT(*) AS n')->pluck('n', 'status');
        $funnel = collect(Crm::STATUSES)->map(fn ($label, $key) => [
            'key' => $key, 'label' => $label, 'count' => (int) ($statusCounts[$key] ?? 0),
        ])->values();
        $totalProspects = (int) $statusCounts->sum();
        $worked = $totalProspects - (int) ($statusCounts['not_contacted'] ?? 0);

        $dealsSent = Inquiry::where('source', 'farming')->whereIn('assigned_to', $agentIds)
            ->where('created_at', '>=', $from->startOfDay())->count();

        $touches     = array_sum($series);
        $prevTouches = array_sum($previous);

        $kpis = [
            'touches'         => $touches,
            'touches_prev'    => $prevTouches,
            'connected'       => (int) $channels->sum('connected'),
            'appointments'    => (int) $channels->sum('appointments'),
            'deals_sent'      => $dealsSent,
            'prospects'       => $totalProspects,
            'worked'          => $worked,
            'worked_pct'      => $totalProspects > 0 ? round($worked / $totalProspects * 100) : 0,
            'warm'            => (int) (($statusCounts['interested'] ?? 0) + ($statusCounts['appraisal_booked'] ?? 0)),
        ];

        // ── Follow-ups: warm prospects with a next action ─────────────────
        $followUps = $prospects()
            ->whereIn('status', ['contacted', 'interested', 'appraisal_booked'])
            ->whereNotNull('next_action')->where('next_action', '!=', '')
            ->with(['scheme:id,name,crm_suburb_id', 'scheme.suburb:id,name', 'agent:id,name'])
            ->orderByRaw("CASE status WHEN 'appraisal_booked' THEN 1 WHEN 'interested' THEN 2 ELSE 3 END")
            ->latest('updated_at')
            ->limit(8)
            ->get()
            ->map(fn (CrmProspect $p) => [
                'id'          => $p->id,
                'owner'       => $p->owner_name,
                'unit'        => $p->unit,
                'scheme_id'   => $p->crm_scheme_id,
                'scheme'      => $p->scheme?->name,
                'suburb'      => $p->scheme?->suburb?->name,
                'status'      => $p->status,
                'next_action' => $p->next_action,
                'agent'       => $p->agent?->name,
            ]);

        // ── Recent outreach ───────────────────────────────────────────────
        $recent = $acts()
            ->with(['prospect:id,owner_name,unit,crm_scheme_id', 'agent:id,name'])
            ->latest('occurred_on')->latest('id')
            ->limit(12)
            ->get()
            ->map(fn (CrmActivity $a) => $this->activityRow($a));

        // ── Pipeline snapshot ─────────────────────────────────────────────
        $pipeline = Inquiry::whereIn('assigned_to', $agentIds)
            ->whereNotIn('status', ['lost'])
            ->groupBy('status')->selectRaw('status, COUNT(*) AS n')->pluck('n', 'status');
        $pipelineStages = [
            ['label' => 'New',       'count' => (int) (($pipeline['new'] ?? 0) + ($pipeline['contacted'] ?? 0))],
            ['label' => 'Qualified', 'count' => (int) ($pipeline['qualified'] ?? 0)],
            ['label' => 'Viewing',   'count' => (int) ($pipeline['viewing'] ?? 0)],
            ['label' => 'Offer',     'count' => (int) ($pipeline['offer'] ?? 0)],
            ['label' => 'Closed',    'count' => (int) (($pipeline['closed'] ?? 0) + ($pipeline['registered'] ?? 0))],
        ];

        return [
            'days'      => $days,
            'kpis'      => $kpis,
            'channels'  => $channels,
            'trend'     => ['labels' => $labels, 'series' => $series, 'previous' => $previous],
            'funnel'    => $funnel,
            'follow_ups'=> $followUps,
            'recent'    => $recent,
            'pipeline'  => $pipelineStages,
        ];
    }

    /**
     * Per-agent outreach league table for the agency overview.
     *
     * @param  Collection<int, User>  $agents
     */
    public function leaderboard(int $agencyId, Collection $agents, int $days): array
    {
        $from = CarbonImmutable::today()->subDays($days - 1)->toDateString();
        $ids  = $agents->pluck('id')->all();
        $connected = $this->inList(Crm::CONNECTED);

        $acts = CrmActivity::where('agency_id', $agencyId)->whereIn('agent_id', $ids)
            ->whereDate('occurred_on', '>=', $from)
            ->groupBy('agent_id', 'channel')
            ->selectRaw("agent_id, channel, SUM(quantity) AS attempts,
                SUM(CASE WHEN outcome IN ($connected) THEN quantity ELSE 0 END) AS connected,
                SUM(CASE WHEN outcome = 'appointment' THEN quantity ELSE 0 END) AS appointments")
            ->get()
            ->groupBy('agent_id');

        $prospects = CrmProspect::where('agency_id', $agencyId)->whereIn('agent_id', $ids)
            ->groupBy('agent_id')
            ->selectRaw("agent_id, COUNT(*) AS total, SUM(CASE WHEN status <> 'not_contacted' THEN 1 ELSE 0 END) AS worked")
            ->get()->keyBy('agent_id');

        $deals = Inquiry::where('source', 'farming')->whereIn('assigned_to', $ids)
            ->where('created_at', '>=', $from)
            ->groupBy('assigned_to')->selectRaw('assigned_to, COUNT(*) AS n')->pluck('n', 'assigned_to');

        return $agents->map(function (User $agent) use ($acts, $prospects, $deals) {
            $rows = $acts->get($agent->id, collect())->keyBy('channel');
            $by = fn (string $ch) => (int) ($rows->get($ch)->attempts ?? 0);
            $total = (int) $rows->sum('attempts');
            $p = $prospects->get($agent->id);

            return [
                'id'           => $agent->id,
                'name'         => $agent->name,
                'calls'        => $by('call'),
                'whatsapp'     => $by('whatsapp'),
                'sms'          => $by('sms'),
                'email'        => $by('email'),
                'other'        => $total - $by('call') - $by('whatsapp') - $by('sms') - $by('email'),
                'touches'      => $total,
                'connected'    => (int) $rows->sum('connected'),
                'appointments' => (int) $rows->sum('appointments'),
                'prospects'    => (int) ($p->total ?? 0),
                'worked'       => (int) ($p->worked ?? 0),
                'deals'        => (int) ($deals[$agent->id] ?? 0),
            ];
        })->sortByDesc('touches')->values()->all();
    }

    /**
     * Farming drill-down: regions → suburbs → schemes → prospects.
     *
     * @param  int[]  $agentIds
     */
    public function farming(int $agencyId, array $agentIds, ?int $regionId, ?int $suburbId, ?int $schemeId): array
    {
        $schemes = fn () => CrmScheme::query()->where('crm_schemes.agency_id', $agencyId)->whereIn('crm_schemes.agent_id', $agentIds);

        if ($schemeId) {
            $scheme = $schemes()->with(['suburb.region', 'agent:id,name'])->findOrFail($schemeId);

            return ['level' => 'scheme'] + $this->schemeLevel($scheme);
        }

        if ($suburbId) {
            $suburb = CrmSuburb::visibleTo($agencyId)->with('region')->findOrFail($suburbId);

            $rows = $schemes()->where('crm_suburb_id', $suburb->id)
                ->with('agent:id,name')
                ->withCount([
                    'prospects',
                    'prospects as contacted_count' => fn ($q) => $q->where('status', '!=', 'not_contacted'),
                    'prospects as warm_count'      => fn ($q) => $q->whereIn('status', ['interested', 'appraisal_booked', 'listed']),
                ])
                ->orderBy('name')
                ->get()
                ->map(fn (CrmScheme $s) => [
                    'id'            => $s->id,
                    'name'          => $s->name,
                    'scheme_number' => $s->scheme_number,
                    'erf'           => $s->erf,
                    'address'       => $s->address,
                    'units_count'   => $s->units_count,
                    'owners'        => (int) $s->prospects_count,
                    'contacted'     => (int) $s->contacted_count,
                    'warm'          => (int) $s->warm_count,
                    'agent'         => $s->agent?->name,
                ]);

            return [
                'level'   => 'suburb',
                'region'  => $this->regionRef($suburb->region),
                'suburb'  => $this->suburbRow($suburb),
                'schemes' => $rows,
            ];
        }

        if ($regionId) {
            $region = CrmRegion::visibleTo($agencyId)->findOrFail($regionId);
            $perSuburb = $schemes()
                ->join('crm_suburbs', 'crm_suburbs.id', '=', 'crm_schemes.crm_suburb_id')
                ->where('crm_suburbs.crm_region_id', $region->id)
                ->groupBy('crm_schemes.crm_suburb_id')
                ->selectRaw('crm_schemes.crm_suburb_id AS sid, COUNT(*) AS n')
                ->pluck('n', 'sid');

            $suburbs = CrmSuburb::visibleTo($agencyId)->where('crm_region_id', $region->id)
                ->orderByRaw('CASE WHEN priority IS NULL THEN 1 ELSE 0 END')->orderBy('priority')->orderBy('name')
                ->get()
                ->map(fn (CrmSuburb $s) => $this->suburbRow($s) + ['schemes' => (int) ($perSuburb[$s->id] ?? 0)]);

            return [
                'level'   => 'region',
                'region'  => $this->regionRef($region),
                'suburbs' => $suburbs,
            ];
        }

        // Top level: regions with roll-ups.
        $suburbCounts = CrmSuburb::visibleTo($agencyId)->groupBy('crm_region_id')
            ->selectRaw('crm_region_id, COUNT(*) AS n')->pluck('n', 'crm_region_id');

        $schemeCounts = $schemes()
            ->join('crm_suburbs', 'crm_suburbs.id', '=', 'crm_schemes.crm_suburb_id')
            ->groupBy('crm_suburbs.crm_region_id')
            ->selectRaw('crm_suburbs.crm_region_id AS rid, COUNT(*) AS n')
            ->pluck('n', 'rid');

        $prospectCounts = CrmProspect::query()
            ->where('crm_prospects.agency_id', $agencyId)->whereIn('crm_prospects.agent_id', $agentIds)
            ->join('crm_schemes', 'crm_schemes.id', '=', 'crm_prospects.crm_scheme_id')
            ->join('crm_suburbs', 'crm_suburbs.id', '=', 'crm_schemes.crm_suburb_id')
            ->groupBy('crm_suburbs.crm_region_id')
            ->selectRaw("crm_suburbs.crm_region_id AS rid, COUNT(*) AS total,
                SUM(CASE WHEN crm_prospects.status <> 'not_contacted' THEN 1 ELSE 0 END) AS contacted")
            ->get()->keyBy('rid');

        $regions = CrmRegion::visibleTo($agencyId)->orderBy('sort')->orderBy('name')->get()
            ->map(fn (CrmRegion $r) => [
                'id'        => $r->id,
                'name'      => $r->name,
                'suburbs'   => (int) ($suburbCounts[$r->id] ?? 0),
                'schemes'   => (int) ($schemeCounts[$r->id] ?? 0),
                'prospects' => (int) ($prospectCounts->get($r->id)->total ?? 0),
                'contacted' => (int) ($prospectCounts->get($r->id)->contacted ?? 0),
            ]);

        return ['level' => 'regions', 'regions' => $regions];
    }

    private function schemeLevel(CrmScheme $scheme): array
    {
        $prospects = $scheme->prospects()->with('agent:id,name')->get()
            ->sortBy(fn (CrmProspect $p) => [$this->unitSort($p->unit), mb_strtolower($p->owner_name)])
            ->values();

        $activities = CrmActivity::whereIn('crm_prospect_id', $prospects->pluck('id'))
            ->latest('occurred_on')->latest('id')->limit(2000)->get()
            ->groupBy('crm_prospect_id')
            ->map(fn ($rows) => $rows->take(15)->map(fn (CrmActivity $a) => $this->activityRow($a))->values());

        return [
            'region'     => $this->regionRef($scheme->suburb->region),
            'suburb'     => $this->suburbRow($scheme->suburb),
            'scheme'     => [
                'id'            => $scheme->id,
                'name'          => $scheme->name,
                'scheme_number' => $scheme->scheme_number,
                'erf'           => $scheme->erf,
                'address'       => $scheme->address,
                'units_count'   => $scheme->units_count,
                'agent'         => $scheme->agent?->name,
            ],
            'prospects'  => $prospects->map(fn (CrmProspect $p) => $this->prospectRow($p)),
            'activities' => $activities,
        ];
    }

    public function prospectRow(CrmProspect $p): array
    {
        return [
            'id'            => $p->id,
            'unit'          => $p->unit,
            'size'          => $p->size,
            'owner_name'    => $p->owner_name,
            'owner_type'    => $p->owner_type,
            'id_reg'        => $p->id_reg,
            'multi_unit'    => $p->multi_unit,
            'phone1'        => $p->phone1,
            'phone2'        => $p->phone2,
            'email'         => $p->email,
            'priority_note' => $p->priority_note,
            'status'        => $p->status,
            'method'        => $p->method,
            'contacted_on'  => $p->contacted_on?->toDateString(),
            'est_value'     => $p->est_value !== null ? (float) $p->est_value : null,
            'response'      => $p->response,
            'next_action'   => $p->next_action,
            'notes'         => $p->notes,
            'inquiry_id'    => $p->inquiry_id,
            'wa_opt_in_at'  => $p->wa_opt_in_at?->format('d M Y'),
            'wa_opted_out_at' => $p->wa_opted_out_at?->format('d M Y'),
            'agent'         => $p->agent?->name,
        ];
    }

    private function activityRow(CrmActivity $a): array
    {
        return [
            'id'          => $a->id,
            'channel'     => $a->channel,
            'outcome'     => $a->outcome,
            'quantity'    => $a->quantity,
            'note'        => $a->note,
            'occurred_on' => $a->occurred_on?->toDateString(),
            'when'        => $a->occurred_on?->isToday() ? 'Today' : $a->occurred_on?->format('d M Y'),
            'prospect'    => $a->relationLoaded('prospect') && $a->prospect ? [
                'id'        => $a->prospect->id,
                'owner'     => $a->prospect->owner_name,
                'unit'      => $a->prospect->unit,
                'scheme_id' => $a->prospect->crm_scheme_id,
            ] : null,
            'agent'       => $a->relationLoaded('agent') ? $a->agent?->name : null,
        ];
    }

    private function suburbRow(CrmSuburb $s): array
    {
        return [
            'id'           => $s->id,
            'name'         => $s->name,
            'municipality' => $s->municipality,
            'signal'       => $s->signal,
            'angle'        => $s->angle,
            'priority'     => $s->priority,
            'stats'        => $s->stats,
            'custom'       => $s->agency_id !== null,
        ];
    }

    private function regionRef(CrmRegion $r): array
    {
        return ['id' => $r->id, 'name' => $r->name];
    }

    /** Numeric-aware unit ordering so "2" comes before "10". */
    private function unitSort(?string $unit): string
    {
        $unit = trim((string) $unit);

        return preg_match('/^\d+/', $unit, $m) ? str_pad($m[0], 8, '0', STR_PAD_LEFT) . $unit : 'zzzz' . $unit;
    }

    private function inList(array $values): string
    {
        return implode(',', array_map(fn ($v) => DB::getPdo()->quote($v), $values));
    }
}
