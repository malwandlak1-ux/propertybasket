<?php

namespace App\Http\Controllers\Agent;

use App\Http\Controllers\Agent\Concerns\ResolvesAgent;
use App\Http\Controllers\Controller;
use App\Models\CrmActivity;
use App\Models\CrmProspect;
use App\Models\CrmRegion;
use App\Models\CrmScheme;
use App\Models\CrmSuburb;
use App\Models\Inquiry;
use App\Services\CrmService;
use App\Support\Crm;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Agent CRM: outreach overview, the property-farming tracker (region →
 * suburb → scheme → owner prospects) and the hand-off into the pipeline.
 * An agent only ever sees and edits their own schemes, prospects and log.
 */
class CrmController extends Controller
{
    use ResolvesAgent;

    public function __construct(private CrmService $crm) {}

    public function overview(Request $request): Response
    {
        $record = $this->resolveAgentRecord($request);
        $days   = $this->days($request);

        return Inertia::render('Agent/Crm/Overview', [
            'agent' => ['id' => $request->user()->id, 'name' => $request->user()->name, 'agency_name' => $record->agency->name],
            'data'  => $this->crm->overview($record->agency_id, [$request->user()->id], $days),
        ]);
    }

    public function farming(Request $request): Response
    {
        $record = $this->resolveAgentRecord($request);
        $q = $request->validate([
            'region' => ['nullable', 'integer'],
            'suburb' => ['nullable', 'integer'],
            'scheme' => ['nullable', 'integer'],
        ]);
        $user = $request->user();

        return Inertia::render('Agent/Crm/Farming', [
            'agent'   => ['id' => $user->id, 'name' => $user->name, 'agency_name' => $record->agency->name],
            'profile' => ['name' => $user->name, 'agency' => $record->agency->name, 'phone' => $user->phone],
            'farm'    => $this->crm->farming(
                $record->agency_id, [$user->id],
                $q['region'] ?? null, $q['suburb'] ?? null, $q['scheme'] ?? null,
            ),
        ]);
    }

    // ── Suburbs & schemes ─────────────────────────────────────────────────

    public function storeSuburb(Request $request): RedirectResponse
    {
        $record = $this->resolveAgentRecord($request);
        $data = $request->validate([
            'region_id' => ['required', 'integer'],
            'name'      => ['required', 'string', 'max:120'],
            'signal'    => ['nullable', Rule::in(['High', 'Moderate', 'Watch'])],
            'angle'     => ['nullable', 'string', 'max:255'],
        ]);

        $region = CrmRegion::visibleTo($record->agency_id)->findOrFail($data['region_id']);
        $exists = CrmSuburb::visibleTo($record->agency_id)->where('crm_region_id', $region->id)
            ->whereRaw('LOWER(name) = ?', [mb_strtolower(trim($data['name']))])->exists();
        if ($exists) {
            return back()->with('error', "{$data['name']} is already in {$region->name}.");
        }

        CrmSuburb::create([
            'crm_region_id' => $region->id,
            'agency_id'     => $record->agency_id,
            'name'          => trim($data['name']),
            'municipality'  => null,
            'signal'        => $data['signal'] ?? null,
            'angle'         => $data['angle'] ?? null,
        ]);

        return back()->with('success', "Suburb {$data['name']} added.");
    }

    public function storeScheme(Request $request): RedirectResponse
    {
        $record = $this->resolveAgentRecord($request);
        $data = $this->validateScheme($request, true);
        $suburb = CrmSuburb::visibleTo($record->agency_id)->findOrFail($data['suburb_id']);

        $scheme = CrmScheme::create([
            'crm_suburb_id' => $suburb->id,
            'agency_id'     => $record->agency_id,
            'agent_id'      => $request->user()->id,
        ] + $this->schemeFields($data));

        return redirect()->route('agent.crm.farming', ['scheme' => $scheme->id])
            ->with('success', "{$scheme->name} added — import its owner register to start farming.");
    }

    public function updateScheme(Request $request, CrmScheme $scheme): RedirectResponse
    {
        $this->own($request, $scheme->agent_id);
        $scheme->update($this->schemeFields($this->validateScheme($request, false)));

        return back()->with('success', 'Scheme updated.');
    }

    public function destroyScheme(Request $request, CrmScheme $scheme): RedirectResponse
    {
        $this->own($request, $scheme->agent_id);
        $suburbId = $scheme->crm_suburb_id;
        $name = $scheme->name;
        $scheme->delete();

        return redirect()->route('agent.crm.farming', ['suburb' => $suburbId])->with('success', "{$name} deleted.");
    }

    // ── Prospects ─────────────────────────────────────────────────────────

    public function storeProspect(Request $request, CrmScheme $scheme): RedirectResponse
    {
        $this->own($request, $scheme->agent_id);
        $data = $this->validateProspect($request);

        $scheme->prospects()->create([
            'agency_id' => $scheme->agency_id,
            'agent_id'  => $scheme->agent_id,
        ] + $this->withContactDate($data));

        return back()->with('success', 'Prospect added.');
    }

    public function updateProspect(Request $request, CrmProspect $prospect): RedirectResponse
    {
        $this->own($request, $prospect->agent_id);
        $prospect->update($this->withContactDate($this->validateProspect($request), $prospect));

        return back()->with('success', 'Prospect saved.');
    }

    public function updateProspectStatus(Request $request, CrmProspect $prospect): RedirectResponse
    {
        $this->own($request, $prospect->agent_id);
        $data = $request->validate(['status' => ['required', Rule::in(array_keys(Crm::STATUSES))]]);
        $prospect->update($this->withContactDate($data, $prospect));

        return back();
    }

    public function destroyProspect(Request $request, CrmProspect $prospect): RedirectResponse
    {
        $this->own($request, $prospect->agent_id);
        $prospect->delete();

        return back()->with('success', 'Prospect deleted.');
    }

    /**
     * POST /agent/crm/schemes/{scheme}/import — owner rows already parsed and
     * column-mapped in the browser (xlsx or csv). Skips owner+unit duplicates.
     */
    public function importProspects(Request $request, CrmScheme $scheme): RedirectResponse
    {
        $this->own($request, $scheme->agent_id);
        $data = $request->validate([
            'rows'               => ['required', 'array', 'min:1', 'max:5000'],
            'rows.*.owner_name'  => ['required', 'string', 'max:255'],
            'rows.*.unit'        => ['nullable', 'string', 'max:40'],
            'rows.*.size'        => ['nullable', 'string', 'max:40'],
            'rows.*.owner_type'  => ['nullable', 'string', 'max:80'],
            'rows.*.id_reg'      => ['nullable', 'string', 'max:40'],
            'rows.*.multi_unit'  => ['nullable', 'string', 'max:120'],
            'rows.*.phone1'      => ['nullable', 'string', 'max:30'],
            'rows.*.phone2'      => ['nullable', 'string', 'max:30'],
            'rows.*.email'       => ['nullable', 'string', 'max:180'],
            'rows.*.priority_note' => ['nullable', 'string', 'max:255'],
            'rows.*.notes'       => ['nullable', 'string', 'max:5000'],
        ]);

        $key = fn ($owner, $unit) => mb_strtolower(trim((string) $owner) . '|' . trim((string) $unit));
        $seen = $scheme->prospects()->get(['owner_name', 'unit'])
            ->mapWithKeys(fn ($p) => [$key($p->owner_name, $p->unit) => true])->all();

        $now = now();
        $insert = [];
        foreach ($data['rows'] as $row) {
            $k = $key($row['owner_name'], $row['unit'] ?? '');
            if (isset($seen[$k])) {
                continue;
            }
            $seen[$k] = true;
            $insert[] = [
                'crm_scheme_id' => $scheme->id,
                'agency_id'     => $scheme->agency_id,
                'agent_id'      => $scheme->agent_id,
                'owner_name'    => trim($row['owner_name']),
                'unit'          => $this->blank($row['unit'] ?? null),
                'size'          => $this->blank($row['size'] ?? null),
                'owner_type'    => $this->blank($row['owner_type'] ?? null),
                'id_reg'        => $this->blank($row['id_reg'] ?? null),
                'multi_unit'    => $this->blank($row['multi_unit'] ?? null),
                'phone1'        => $this->blank($row['phone1'] ?? null),
                'phone2'        => $this->blank($row['phone2'] ?? null),
                'email'         => $this->blank($row['email'] ?? null),
                'priority_note' => $this->blank($row['priority_note'] ?? null),
                'notes'         => $this->blank($row['notes'] ?? null),
                'status'        => 'not_contacted',
                'created_at'    => $now,
                'updated_at'    => $now,
            ];
        }

        DB::transaction(function () use ($insert) {
            foreach (array_chunk($insert, 200) as $chunk) {
                CrmProspect::insert($chunk);
            }
        });

        $skipped = count($data['rows']) - count($insert);

        return back()->with('success', count($insert) . ' owners imported' . ($skipped ? " ({$skipped} duplicates skipped)." : '.'));
    }

    public function exportProspects(Request $request, CrmScheme $scheme): StreamedResponse
    {
        $this->own($request, $scheme->agent_id);

        return self::csv($scheme);
    }

    // ── Outreach log ──────────────────────────────────────────────────────

    /**
     * POST /agent/crm/activities — log one contact with a prospect (moves its
     * status on) or a batch campaign ("350 SMS sent") with no prospect.
     */
    public function storeActivity(Request $request): RedirectResponse
    {
        $record = $this->resolveAgentRecord($request);
        $data = $request->validate([
            'prospect_id' => ['nullable', 'integer'],
            'channel'     => ['required', Rule::in(array_keys(Crm::CHANNELS))],
            'outcome'     => ['nullable', Rule::in(array_keys(Crm::OUTCOMES))],
            'quantity'    => ['nullable', 'integer', 'min:1', 'max:100000'],
            'note'        => ['nullable', 'string', 'max:500'],
            'occurred_on' => ['required', 'date', 'before_or_equal:today'],
        ]);

        $prospect = null;
        if (! empty($data['prospect_id'])) {
            $prospect = CrmProspect::findOrFail($data['prospect_id']);
            $this->own($request, $prospect->agent_id);
        }

        DB::transaction(function () use ($data, $record, $request, $prospect) {
            CrmActivity::create([
                'agency_id'       => $record->agency_id,
                'agent_id'        => $request->user()->id,
                'crm_prospect_id' => $prospect?->id,
                'channel'         => $data['channel'],
                'outcome'         => $data['outcome'] ?? ($prospect ? null : 'sent'),
                'quantity'        => $prospect ? 1 : ($data['quantity'] ?? 1),
                'note'            => $data['note'] ?? null,
                'occurred_on'     => $data['occurred_on'],
            ]);

            if ($prospect) {
                $updates = ['method' => $data['channel']];
                if (! empty($data['outcome'])) {
                    $updates['status'] = Crm::statusAfter($prospect->status, $data['outcome']);
                }
                if (! $prospect->contacted_on) {
                    $updates['contacted_on'] = $data['occurred_on'];
                }
                if (! empty($data['note'])) {
                    $updates['response'] = mb_substr($data['note'], 0, 500);
                }
                $prospect->update($updates);
            }
        });

        $msg = $prospect
            ? 'Contact logged.'
            : number_format($data['quantity'] ?? 1) . ' ' . Crm::CHANNELS[$data['channel']] . ' touches logged.';

        return back()->with('success', $msg);
    }

    public function destroyActivity(Request $request, CrmActivity $activity): RedirectResponse
    {
        $this->own($request, $activity->agent_id);
        $activity->delete();

        return back()->with('success', 'Activity removed.');
    }

    // ── Pipeline hand-off ─────────────────────────────────────────────────

    /**
     * POST /agent/crm/prospects/{prospect}/pipeline — turn a warm owner into a
     * seller lead on the pipeline (no listing yet; deal value = est. value).
     */
    public function sendToPipeline(Request $request, CrmProspect $prospect): RedirectResponse
    {
        $this->own($request, $prospect->agent_id);
        if ($prospect->inquiry_id && Inquiry::whereKey($prospect->inquiry_id)->exists()) {
            return back()->with('error', 'This owner is already on your pipeline.');
        }

        $prospect->loadMissing('scheme.suburb');
        $where = trim(collect([
            $prospect->scheme?->name . ($prospect->unit ? " unit {$prospect->unit}" : ''),
            $prospect->scheme?->suburb?->name,
        ])->filter()->implode(', '));

        $inquiry = Inquiry::create([
            'listing_id'        => null,
            'name'              => $prospect->owner_name,
            'email'             => $prospect->email,
            'phone'             => $prospect->phone1 ?: $prospect->phone2,
            'message'           => trim("Seller lead from farming — {$where}. " . ($prospect->response ?? '')),
            'deal_value'        => $prospect->est_value,
            'assigned_to'       => $prospect->agent_id,
            'source'            => 'farming',
            'status'            => $prospect->status === 'appraisal_booked' ? 'viewing' : 'qualified',
            'allocated_at'      => now(),
            'allocation_method' => 'manual',
        ]);

        $prospect->update(['inquiry_id' => $inquiry->id]);

        return back()->with('success', "{$prospect->owner_name} added to your pipeline.");
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    /** Shared by the agency export (view-only access). */
    public static function csv(CrmScheme $scheme): StreamedResponse
    {
        $filename = preg_replace('/[^A-Za-z0-9_-]+/', '_', $scheme->name) . '_prospects.csv';

        return response()->streamDownload(function () use ($scheme) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['Unit', 'Unit Size', 'Owner Type', 'Registered Owner', 'ID/Reg', 'Multi-Unit', 'Priority',
                'Phone 1', 'Phone 2', 'Email', 'Status', 'Method', 'Date Contacted', 'Response', 'Next Action', 'Est Value', 'Notes', 'Agent']);
            $scheme->prospects()->with('agent:id,name')->orderBy('id')->chunk(500, function ($rows) use ($out) {
                foreach ($rows as $p) {
                    fputcsv($out, [
                        $p->unit, $p->size, $p->owner_type, $p->owner_name, $p->id_reg, $p->multi_unit, $p->priority_note,
                        $p->phone1, $p->phone2, $p->email, Crm::STATUSES[$p->status] ?? $p->status,
                        Crm::CHANNELS[$p->method] ?? $p->method, $p->contacted_on?->toDateString(),
                        $p->response, $p->next_action, $p->est_value, $p->notes, $p->agent?->name,
                    ]);
                }
            });
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    private function own(Request $request, int $agentId): void
    {
        abort_unless((int) $agentId === (int) $request->user()->id, 403, 'This record belongs to another agent.');
    }

    private function days(Request $request): int
    {
        $d = (int) $request->query('range', 30);

        return in_array($d, [7, 30, 90], true) ? $d : 30;
    }

    private function validateScheme(Request $request, bool $creating): array
    {
        return $request->validate(array_filter([
            'suburb_id'     => $creating ? ['required', 'integer'] : null,
            'name'          => ['required', 'string', 'max:160'],
            'scheme_number' => ['nullable', 'string', 'max:60'],
            'erf'           => ['nullable', 'string', 'max:60'],
            'address'       => ['nullable', 'string', 'max:255'],
            'units_count'   => ['nullable', 'integer', 'min:1', 'max:100000'],
        ]));
    }

    private function schemeFields(array $data): array
    {
        return [
            'name'          => trim($data['name']),
            'scheme_number' => $data['scheme_number'] ?? null,
            'erf'           => $data['erf'] ?? null,
            'address'       => $data['address'] ?? null,
            'units_count'   => $data['units_count'] ?? null,
        ];
    }

    private function validateProspect(Request $request): array
    {
        return $request->validate([
            'owner_name'    => ['required', 'string', 'max:255'],
            'unit'          => ['nullable', 'string', 'max:40'],
            'size'          => ['nullable', 'string', 'max:40'],
            'owner_type'    => ['nullable', 'string', 'max:80'],
            'id_reg'        => ['nullable', 'string', 'max:40'],
            'multi_unit'    => ['nullable', 'string', 'max:120'],
            'phone1'        => ['nullable', 'string', 'max:30'],
            'phone2'        => ['nullable', 'string', 'max:30'],
            'email'         => ['nullable', 'email', 'max:180'],
            'priority_note' => ['nullable', 'string', 'max:255'],
            'status'        => ['required', Rule::in(array_keys(Crm::STATUSES))],
            'method'        => ['nullable', Rule::in(array_keys(Crm::CHANNELS))],
            'contacted_on'  => ['nullable', 'date'],
            'est_value'     => ['nullable', 'numeric', 'min:0', 'max:9999999999'],
            'response'      => ['nullable', 'string', 'max:500'],
            'next_action'   => ['nullable', 'string', 'max:500'],
            'notes'         => ['nullable', 'string', 'max:5000'],
        ]);
    }

    /** Stamp the first-contact date when a prospect leaves "Not contacted". */
    private function withContactDate(array $data, ?CrmProspect $existing = null): array
    {
        $status = $data['status'] ?? $existing?->status;
        $hasDate = array_key_exists('contacted_on', $data) ? ! empty($data['contacted_on']) : (bool) $existing?->contacted_on;
        if ($status && $status !== 'not_contacted' && ! $hasDate) {
            $data['contacted_on'] = now()->toDateString();
        }

        return $data;
    }

    private function blank(?string $v): ?string
    {
        $v = trim((string) $v);

        return $v === '' ? null : $v;
    }
}
