<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Agent\AnalyticsController;
use App\Http\Controllers\Agent\CommissionController;
use App\Http\Controllers\Agent\CrmController;
use App\Http\Controllers\Agent\DashboardController;
use App\Http\Controllers\Agent\FfcController;
use App\Http\Controllers\Agent\InspectionsController;
use App\Http\Controllers\Agent\ListingsController;
use App\Http\Controllers\Agent\MaintenanceController;
use App\Http\Controllers\Agent\MessagesController;
use App\Http\Controllers\Agent\PipelineController;
use App\Http\Controllers\Agent\SettingsController;
use App\Http\Controllers\Agent\TenantsController;
use App\Http\Controllers\Api\V1\Concerns\RendersInertiaJson;
use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\Inquiry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Mobile API for the agent role. Every method delegates to the matching web
 * controller so the app and the website share one code path: GETs return the
 * page's Inertia props, writes run the same validation and logic.
 *
 * Web controllers answer a refused write with `back()->with('error')`. A
 * redirect means nothing to the app, so guards that the web expresses that
 * way are checked here first and returned as proper 403 / 422 JSON.
 */
class AgentController extends Controller
{
    use RendersInertiaJson;

    /* ---------- Read-only tabs ---------- */

    public function overview(Request $request, DashboardController $web): JsonResponse
    {
        return $this->inertiaJson($request, $web->overview($request));
    }

    public function listings(Request $request, ListingsController $web): JsonResponse
    {
        return $this->inertiaJson($request, $web->index($request));
    }

    public function tenants(Request $request, TenantsController $web): JsonResponse
    {
        return $this->inertiaJson($request, $web->index($request));
    }

    public function maintenance(Request $request, MaintenanceController $web): JsonResponse
    {
        return $this->inertiaJson($request, $web->index($request));
    }

    public function commission(Request $request, CommissionController $web): JsonResponse
    {
        return $this->inertiaJson($request, $web->index($request));
    }

    public function analytics(Request $request, AnalyticsController $web): JsonResponse
    {
        // The web action streams a CSV when ?export is set; the app only reads.
        $request->query->remove('export');

        return $this->inertiaJson($request, $web->index($request));
    }

    public function inspections(Request $request, InspectionsController $web): JsonResponse
    {
        return $this->inertiaJson($request, $web->index($request));
    }

    public function ffc(Request $request, FfcController $web): JsonResponse
    {
        return $this->inertiaJson($request, $web->index($request));
    }

    public function settings(Request $request, SettingsController $web): JsonResponse
    {
        return $this->inertiaJson($request, $web->index($request));
    }

    public function crm(Request $request, CrmController $web): JsonResponse
    {
        return $this->inertiaJson($request, $web->overview($request));
    }

    /* ---------- Leads (pipeline) ---------- */

    public function pipeline(Request $request, PipelineController $web): JsonResponse
    {
        return $this->inertiaJson($request, $web->index($request));
    }

    public function storeLead(Request $request, PipelineController $web): JsonResponse
    {
        $web->storeLead($request);

        return response()->json(['message' => 'Lead added to your pipeline.'], 201);
    }

    public function updateLeadStatus(Request $request, Inquiry $inquiry, PipelineController $web): JsonResponse
    {
        abort_unless((int) $inquiry->assigned_to === (int) $request->user()->id, 403, 'You can only move your own leads.');
        abort_if($inquiry->status === 'registered', 422, 'This deal has been registered by your agency and is locked.');

        $web->updateLeadStatus($request, $inquiry);

        return response()->json(['message' => 'Lead status updated.', 'status' => $inquiry->fresh()->status]);
    }

    /** PATCH — set (or, with empty date + time, clear) the lead's viewing slot. */
    public function scheduleLeadViewing(Request $request, Inquiry $inquiry, PipelineController $web): JsonResponse
    {
        $web->scheduleViewing($request, $inquiry);

        $at = $inquiry->fresh()->viewing_scheduled_at;

        return response()->json([
            'message'    => $at ? 'Viewing scheduled.' : 'Viewing removed.',
            'viewing_at' => $at?->format('D d M · H:i'),
        ]);
    }

    /* ---------- Messages ---------- */

    /** GET ?conversation_id= — conversation list, plus the open thread (marks it read). */
    public function messages(Request $request, MessagesController $web): JsonResponse
    {
        return $this->inertiaJson($request, $web->index($request));
    }

    public function sendMessage(Request $request, Conversation $conversation, MessagesController $web): JsonResponse
    {
        $web->store($request, $conversation);

        return response()->json(['message' => 'Sent.'], 201);
    }
}
