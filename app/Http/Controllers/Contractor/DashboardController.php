<?php

namespace App\Http\Controllers\Contractor;

use App\Http\Controllers\Contractor\Concerns\ResolvesContractor;
use App\Models\MaintenanceInvoice;
use App\Models\MaintenanceQuote;
use App\Models\MaintenanceRequest;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    use ResolvesContractor;

    public function overview(Request $request): Response
    {
        $contractor = $this->resolveContractor($request);
        $userId     = $contractor->user_id;
        $now        = CarbonImmutable::now();
        $monthStart = $now->startOfMonth();

        // ── KPI counts ────────────────────────────────────────────────────
        $activeJobs   = MaintenanceRequest::where('assigned_to', $userId)
            ->whereIn('status', ['in_progress', 'completed'])->count();
        $openRequests = MaintenanceRequest::where('assigned_to', $userId)
            ->where('status', 'open')->count();
        $pendingQuotes = MaintenanceQuote::where('contractor_id', $contractor->id)
            ->where('status', 'sent')->count();

        $monthEarnings = MaintenanceInvoice::where('contractor_id', $contractor->id)
            ->whereNotNull('paid_at')
            ->where('paid_at', '>=', $monthStart)
            ->sum('invoice_total');

        // ── Emergency alert (highest urgency open request) ────────────────
        $emergency = MaintenanceRequest::where('assigned_to', $userId)
            ->where('status', 'open')
            ->where('urgency', 'emergency')
            ->with(['property', 'submitter'])
            ->orderByDesc('created_at')
            ->first();

        $emergencyData = $emergency ? [
            'id'       => $emergency->id,
            'title'    => $emergency->title,
            'property' => $emergency->property?->suburb ?? '—',
            'address'  => $emergency->property?->address,
            'agency'   => optional($emergency->property?->owner)->name ?? '—',
            'created'  => $emergency->created_at?->diffForHumans(),
        ] : null;

        // ── Active jobs list (top 4) ─────────────────────────────────────
        $jobs = MaintenanceRequest::where('assigned_to', $userId)
            ->whereIn('status', ['open', 'in_progress'])
            ->with(['property', 'submitter'])
            ->orderByDesc('updated_at')
            ->limit(4)
            ->get()
            ->map(fn ($r) => [
                'id'        => $r->id,
                'title'     => $r->title,
                'property'  => $r->property?->suburb ?? '—',
                'tenant'    => $r->submitter?->name ?? '—',
                'urgency'   => $r->urgency,
                'category'  => $r->category,
                'status'    => $r->status,
                'preferred' => $r->preferred_date?->format('d M'),
                'time_slot' => $r->preferred_time_slot,
            ]);

        // ── Quote expiring soon ──────────────────────────────────────────
        $expiringQuote = MaintenanceQuote::where('contractor_id', $contractor->id)
            ->where('status', 'sent')
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', $now->addDays(3))
            ->with('request')
            ->orderBy('expires_at')
            ->first();

        // ── Recent activity (last 5 events) ──────────────────────────────
        $recentInvoices = MaintenanceInvoice::where('contractor_id', $contractor->id)
            ->with('request')
            ->orderByDesc('updated_at')
            ->limit(5)
            ->get()
            ->map(fn ($inv) => [
                'id'      => $inv->id,
                'title'   => $inv->request?->title ?? 'Invoice',
                'amount'  => (float) $inv->invoice_total,
                'status'  => $inv->status,
                'when'    => $inv->updated_at?->diffForHumans(),
            ]);

        return Inertia::render('Contractor/Overview', [
            'counts'      => $this->sidebarCounts($contractor),
            'contractor'  => [
                'id'             => $contractor->id,
                'name'           => $contractor->user?->name ?? '—',
                'business_name'  => $contractor->business_name,
                'average_rating' => (float) ($contractor->average_rating ?? 0),
                'total_reviews'  => $contractor->total_reviews ?? 0,
                'total_jobs'     => $contractor->total_jobs ?? 0,
            ],
            'kpis'        => [
                'active_jobs'    => $activeJobs,
                'open_requests'  => $openRequests,
                'pending_quotes' => $pendingQuotes,
                'month_earnings' => (float) $monthEarnings,
            ],
            'emergency'   => $emergencyData,
            'jobs'        => $jobs,
            'expiring_quote' => $expiringQuote ? [
                'id'       => $expiringQuote->id,
                'title'    => $expiringQuote->request?->title ?? 'Quote',
                'total'    => (float) $expiringQuote->total,
                'expires'  => $expiringQuote->expires_at?->diffForHumans(),
            ] : null,
            'recent_invoices' => $recentInvoices,
        ]);
    }
}
