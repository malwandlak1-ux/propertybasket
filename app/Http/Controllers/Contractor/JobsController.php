<?php

namespace App\Http\Controllers\Contractor;

use App\Http\Controllers\Contractor\Concerns\ResolvesContractor;
use App\Models\MaintenanceRequest;
use App\Notifications\MaintenanceJobAccepted;
use App\Notifications\MaintenanceJobCompleted;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Notification;
use Inertia\Inertia;
use Inertia\Response;

class JobsController extends Controller
{
    use ResolvesContractor;

    public function index(Request $request): Response
    {
        $contractor = $this->resolveContractor($request);
        $userId     = $contractor->user_id;

        // All jobs ever touched by this contractor
        $jobs = MaintenanceRequest::where('assigned_to', $userId)
            ->whereIn('status', ['open', 'in_progress', 'completed', 'paid'])
            ->with(['property.owner', 'submitter', 'invoice'])
            ->orderByDesc('updated_at')
            ->limit(40)
            ->get();

        // Bucket into kanban columns
        $columns = [
            'to_commence' => ['label' => 'To Commence', 'tone' => 'warning', 'jobs' => []],
            'in_progress' => ['label' => 'In Progress', 'tone' => 'brand',   'jobs' => []],
            'completed'   => ['label' => 'Completed',   'tone' => 'success', 'jobs' => []],
            'paid'        => ['label' => 'Paid',        'tone' => 'emerald', 'jobs' => []],
        ];

        foreach ($jobs as $job) {
            // assigned+open = "to commence"
            $col = match ($job->status) {
                'open'        => 'to_commence',
                'in_progress' => 'in_progress',
                'completed'   => 'completed',
                'paid'        => 'paid',
                default       => null,
            };
            if ($col === null) {
                continue;
            }

            $columns[$col]['jobs'][] = [
                'id'         => $job->id,
                'title'      => $job->title,
                'category'   => $job->category,
                'urgency'    => $job->urgency,
                'property'   => $job->property?->suburb ?? '—',
                'tenant'     => $job->submitter?->name ?? '—',
                'agency'     => optional($job->property?->owner)->name ?? '—',
                'when'       => $job->preferred_date?->format('d M') ?? '—',
                'time_slot'  => $job->preferred_time_slot,
                'completed'  => $job->completed_at?->format('d M'),
                'invoice'    => $job->invoice ? [
                    'id'     => $job->invoice->id,
                    'status' => $job->invoice->status,
                    'total'  => (float) $job->invoice->invoice_total,
                ] : null,
            ];
        }

        return Inertia::render('Contractor/Jobs', [
            'counts'  => $this->sidebarCounts($contractor),
            'columns' => array_values(array_map(function ($k, $v) {
                return ['key' => $k] + $v;
            }, array_keys($columns), $columns)),
        ]);
    }

    public function start(Request $request, MaintenanceRequest $maintenanceRequest)
    {
        $contractor = $this->resolveContractor($request);
        abort_unless($maintenanceRequest->assigned_to === $contractor->user_id, 403);

        $maintenanceRequest->update(['status' => 'in_progress']);

        // Notify the tenant.
        if ($tenant = \App\Models\User::find($maintenanceRequest->submitted_by)) {
            $tenant->notify(new MaintenanceJobAccepted($maintenanceRequest));
        }

        return back()->with('status', 'Job started.');
    }

    public function complete(Request $request, MaintenanceRequest $maintenanceRequest)
    {
        $contractor = $this->resolveContractor($request);
        abort_unless($maintenanceRequest->assigned_to === $contractor->user_id, 403);

        $maintenanceRequest->update([
            'status'       => 'completed',
            'completed_at' => now(),
        ]);

        // Notify tenant + lease's agent + landlord.
        $maintenanceRequest->loadMissing('lease');
        $recipients = [];
        if ($tenant = \App\Models\User::find($maintenanceRequest->submitted_by)) {
            $recipients[] = $tenant;
        }
        if ($maintenanceRequest->lease?->agent_id
            && ($agent = \App\Models\User::find($maintenanceRequest->lease->agent_id))) {
            $recipients[] = $agent;
        }
        if ($maintenanceRequest->lease?->landlord_id
            && ($landlord = \App\Models\User::find($maintenanceRequest->lease->landlord_id))) {
            $recipients[] = $landlord;
        }
        if (! empty($recipients)) {
            Notification::send($recipients, new MaintenanceJobCompleted($maintenanceRequest));
        }

        return back()->with('status', 'Job marked complete. Submit your invoice next.');
    }
}
