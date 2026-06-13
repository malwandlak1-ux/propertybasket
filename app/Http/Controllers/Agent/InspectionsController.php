<?php

namespace App\Http\Controllers\Agent;

use App\Http\Controllers\Agent\Concerns\ResolvesAgent;
use App\Http\Controllers\Controller;
use App\Models\Commission;
use App\Models\Inspection;
use App\Models\Lease;
use App\Services\CommissionService;
use App\Services\PdfService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class InspectionsController extends Controller
{
    use ResolvesAgent;

    public function index(Request $request): Response
    {
        $user        = $request->user();
        $agentRecord = $this->resolveAgentRecord($request);
        $agencyId    = $agentRecord->agency_id;

        $baseQuery = Inspection::where('conducted_by', $user->id)
            ->with([
                'lease.listing:id,title,suburb,city,primary_image',
                'tenant:id,name',
            ]);

        $moveIn = (clone $baseQuery)->where('type', 'move_in')
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn ($i) => $this->formatCard($i));

        $moveOut = (clone $baseQuery)->where('type', 'move_out')
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn ($i) => $this->formatCard($i));

        $upcoming = Lease::where('agency_id', $agencyId)
            ->where('agent_id', $user->id)
            ->where('status', 'active')
            ->whereBetween('start_date', [now(), now()->addDays(7)])
            ->whereDoesntHave('inspections', fn ($q) => $q->where('type', 'move_in'))
            ->with(['listing:id,title', 'tenant:id,name'])
            ->take(3)
            ->get()
            ->map(fn ($l) => [
                'lease_id'   => $l->id,
                'listing'    => $l->listing?->title ?? '—',
                'tenant'     => $l->tenant?->name ?? '—',
                'start_date' => $l->start_date?->format('d M Y'),
            ]);

        return Inertia::render('Agent/Inspections', [
            'agent'    => ['id' => $user->id, 'name' => $user->name, 'agency_name' => $agentRecord->agency->name],
            'move_in'  => $moveIn,
            'move_out' => $moveOut,
            'upcoming' => $upcoming,
            'counts'   => ['move_in' => $moveIn->count(), 'move_out' => $moveOut->count()],
        ]);
    }

    /**
     * GET /agent/inspections/create — the form. Pre-selects type from ?type=.
     */
    public function create(Request $request): Response
    {
        $user        = $request->user();
        $agentRecord = $this->resolveAgentRecord($request);

        $type = $request->query('type') === 'move_out' ? 'move_out' : 'move_in';

        $leases = Lease::where('agent_id', $user->id)
            ->where('agency_id', $agentRecord->agency_id)
            ->whereIn('status', ['active', 'pending', 'expired', 'terminated'])
            ->whereDoesntHave('inspections', fn ($q) => $q->where('type', $type))
            ->with(['listing:id,title,suburb,city', 'tenant:id,name,email'])
            ->orderByDesc('start_date')
            ->get()
            ->map(fn ($l) => [
                'id'           => $l->id,
                'label'        => ($l->listing?->title ?? '—') . ' · ' . ($l->tenant?->name ?? '—'),
                'tenant_id'    => $l->tenant_id,
                'tenant_name'  => $l->tenant?->name,
                'listing_title'=> $l->listing?->title,
                'start_date'   => $l->start_date?->format('Y-m-d'),
                'end_date'     => $l->end_date?->format('Y-m-d'),
            ]);

        return Inertia::render('Agent/CreateInspection', [
            'agent'  => ['id' => $user->id, 'name' => $user->name, 'agency_name' => $agentRecord->agency->name],
            'type'   => $type,
            'leases' => $leases,
        ]);
    }

    /**
     * POST /agent/inspections — create the inspection and mark it completed.
     * Inspections are immutable after creation; there's no update endpoint.
     */
    public function store(Request $request): RedirectResponse
    {
        $user        = $request->user();
        $agentRecord = $this->resolveAgentRecord($request);

        $data = $request->validate([
            'lease_id'          => ['required', 'integer', 'exists:leases,id'],
            'type'              => ['required', Rule::in(['move_in', 'move_out'])],
            'rooms'             => ['required', 'array', 'min:1'],
            'rooms.*.name'      => ['required', 'string', 'max:80'],
            'rooms.*.condition' => ['required', Rule::in(['excellent', 'good', 'fair', 'poor'])],
            'rooms.*.notes'     => ['nullable', 'string', 'max:1000'],
            'rooms.*.photos'    => ['nullable', 'array', 'max:10'],
            'rooms.*.photos.*'  => ['image', 'max:8192'], // 8 MB per photo (phone cameras)
            'general_notes'     => ['nullable', 'string', 'max:2000'],
        ]);

        $lease = Lease::with('listing')->findOrFail($data['lease_id']);

        abort_unless(
            $lease->agent_id === $user->id && $lease->agency_id === $agentRecord->agency_id,
            403,
            'You can only inspect leases assigned to you.'
        );

        $existing = Inspection::where('lease_id', $lease->id)->where('type', $data['type'])->exists();
        abort_if($existing, 422, 'A ' . str_replace('_', '-', $data['type']) . ' inspection already exists for this lease.');

        $rooms = collect($data['rooms'])->map(fn ($r) => [
            'name'      => $r['name'],
            'condition' => $r['condition'],
            'notes'     => $r['notes'] ?? null,
            'photos'    => [],
        ])->all();

        $inspection = DB::transaction(function () use ($data, $lease, $user, $rooms) {
            return Inspection::create([
                'lease_id'        => $lease->id,
                'type'            => $data['type'],
                'conducted_by'    => $user->id,
                'tenant_id'       => $lease->tenant_id,
                'status'          => 'completed',
                'rooms'           => $rooms,
                'agent_signed_at' => now(),
                'agent_signature' => $user->name,
                'deduction_total' => 0,
            ]);
        });

        // Store per-room photos (uploaded or captured on the agent's phone)
        // and persist their public URLs into the rooms JSON. Note: don't use
        // hasFile('rooms') — it can't see files nested under rooms.N.photos.
        $dir = "inspections/{$inspection->id}";
        $hasPhotos = false;
        foreach (array_keys($rooms) as $i) {
            foreach ($request->file("rooms.{$i}.photos") ?? [] as $photo) {
                $path = $photo->store($dir, 'public');
                $rooms[$i]['photos'][] = Storage::url($path);
                $hasPhotos = true;
            }
        }
        if ($hasPhotos) {
            $inspection->update(['rooms' => $rooms]);
        }

        // A completed move-in inspection releases the agent's rental commission,
        // which is held ('awaiting_move_in_inspection') until this point.
        $released = false;
        if ($data['type'] === 'move_in') {
            Commission::where('lease_id', $lease->id)
                ->where('deal_type', 'rental')
                ->where('status', 'blocked')
                ->with('agent')
                ->get()
                ->each(function ($c) use (&$released) {
                    if (! app(CommissionService::class)->blockIfNonCompliant($c)) {
                        $released = true;
                    }
                });
        }

        $msg = ucfirst(str_replace('_', '-', $data['type'])) . ' inspection added.'
            . ($released ? ' Your commission for this rental is now in the agency payout queue.' : '');

        return redirect()
            ->route('agent.inspections.show', $inspection->id)
            ->with('success', $msg);
    }

    /**
     * GET /agent/inspections/{inspection} — read-only view.
     */
    public function show(Request $request, Inspection $inspection): Response
    {
        $user        = $request->user();
        $agentRecord = $this->resolveAgentRecord($request);

        $inspection->loadMissing(['lease.listing', 'tenant']);

        abort_unless(
            $inspection->conducted_by === $user->id
                || $inspection->lease?->agency_id === $agentRecord->agency_id,
            403,
        );

        $rooms = is_array($inspection->rooms) ? $inspection->rooms : [];

        return Inertia::render('Agent/ShowInspection', [
            'agent'      => ['id' => $user->id, 'name' => $user->name, 'agency_name' => $agentRecord->agency->name],
            'inspection' => [
                'id'              => $inspection->id,
                'type'            => $inspection->type,
                'status'          => $inspection->status,
                'rooms'           => $rooms,
                'agent_signed_at' => $inspection->agent_signed_at?->format('d M Y · H:i'),
                'agent_signature' => $inspection->agent_signature,
                'tenant_signed_at'=> $inspection->tenant_signed_at?->format('d M Y · H:i'),
                'tenant_signature'=> $inspection->tenant_signature,
                'created_at'      => $inspection->created_at?->format('d M Y · H:i'),
                'pdf_url'         => route('agent.inspections.download', $inspection->id),
            ],
            'lease' => [
                'id'           => $inspection->lease?->id,
                'tenant_name'  => $inspection->tenant?->name,
                'tenant_email' => $inspection->tenant?->email,
                'start_date'   => $inspection->lease?->start_date?->format('d M Y'),
                'end_date'     => $inspection->lease?->end_date?->format('d M Y'),
            ],
            'listing' => [
                'id'            => $inspection->lease?->listing?->id,
                'title'         => $inspection->lease?->listing?->title,
                'address'       => trim(implode(', ', array_filter([
                    $inspection->lease?->listing?->address,
                    $inspection->lease?->listing?->suburb,
                    $inspection->lease?->listing?->city,
                ]))),
                'primary_image' => $inspection->lease?->listing?->primary_image,
            ],
        ]);
    }

    private function formatCard(Inspection $i): array
    {
        $rooms     = is_array($i->rooms) ? $i->rooms : [];
        $total     = count($rooms);
        $completed = count(array_filter($rooms, fn ($r) => ! empty($r['photos']) || ! empty($r['condition'])));
        $pct       = $total > 0 ? (int) round(($completed / $total) * 100) : 0;

        $photoCount = 0;
        foreach ($rooms as $room) {
            $photoCount += count($room['photos'] ?? []);
        }

        $deductions = 0.0;
        if ($i->type === 'move_out') {
            $relSum = (float) $i->deductions()->sum('amount');
            $deductions = $relSum > 0 ? $relSum : (float) ($i->deduction_total ?? 0);
        }

        $deposit = 0.0;
        if ($i->type === 'move_out') {
            $deposit = (float) ($i->lease?->deposit_amount ?? 0);
        }

        return [
            'id'            => $i->id,
            'type'          => $i->type,
            'status'        => $i->status,
            'listing'       => $i->lease?->listing?->title ?? '—',
            'tenant'        => $i->tenant?->name ?? '—',
            'date'          => $i->updated_at?->format('d M Y'),
            'rooms_total'   => $total,
            'rooms_done'    => $completed,
            'pct'           => $pct,
            'photo_count'   => $photoCount,
            'deductions'    => $deductions,
            'deposit'       => $deposit,
            'color_class'   => $this->colorClass($i->id),
            'agent_signed'  => ! is_null($i->agent_signed_at),
            'tenant_signed' => ! is_null($i->tenant_signed_at),
            'primary_image' => $i->lease?->listing?->primary_image,
            'view_url'      => route('agent.inspections.show', $i->id),
        ];
    }

    private function colorClass(int $id): string
    {
        $classes = [
            'from-amber-300 via-amber-200 to-orange-300',
            'from-sky-300 via-sky-200 to-cyan-300',
            'from-emerald-300 via-emerald-200 to-teal-300',
            'from-rose-300 via-rose-200 to-pink-300',
            'from-violet-300 via-violet-200 to-purple-300',
        ];
        return $classes[$id % count($classes)];
    }

    public function download(Request $request, Inspection $inspection, PdfService $pdf)
    {
        $agencyAgent = $this->resolveAgentRecord($request);
        $inspection->loadMissing('lease');
        abort_unless($inspection->lease?->agency_id === $agencyAgent->agency_id, 403);

        return $pdf->inspectionReport($inspection, download: $request->boolean('download'));
    }
}
