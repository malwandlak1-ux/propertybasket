<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Agent\CrmController;
use App\Http\Controllers\Agent\WhatsAppController;
use App\Http\Controllers\Api\V1\Concerns\RendersInertiaJson;
use App\Http\Controllers\Controller;
use App\Models\CrmProspect;
use App\Models\CrmScheme;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Mobile API for the agent CRM tab: overview, property farming (drill down to
 * a scheme's owners, log contacts, hand off to the pipeline) and the WhatsApp
 * inbox. Delegates to the web CrmController / WhatsAppController.
 *
 * Desk work stays on the website: spreadsheet import/export, regions/suburbs/
 * schemes setup, WhatsApp account connection, templates and campaigns.
 */
class AgentCrmController extends Controller
{
    use RendersInertiaJson;

    /** GET /agent/crm?days= — outreach stats. */
    public function overview(Request $request, CrmController $web): JsonResponse
    {
        return $this->inertiaJson($request, $web->overview($request));
    }

    /** GET /agent/crm/farming?region=&suburb=&scheme= — the farming tree at the chosen level. */
    public function farming(Request $request, CrmController $web): JsonResponse
    {
        return $this->inertiaJson($request, $web->farming($request));
    }

    public function storeProspect(Request $request, CrmScheme $scheme, CrmController $web): JsonResponse
    {
        $message = $this->webWrite(fn () => $web->storeProspect($request, $scheme), 'Prospect added.');

        return response()->json(['message' => $message], 201);
    }

    public function updateProspect(Request $request, CrmProspect $prospect, CrmController $web): JsonResponse
    {
        return response()->json(['message' => $this->webWrite(fn () => $web->updateProspect($request, $prospect), 'Prospect saved.')]);
    }

    public function updateProspectStatus(Request $request, CrmProspect $prospect, CrmController $web): JsonResponse
    {
        $this->webWrite(fn () => $web->updateProspectStatus($request, $prospect));

        return response()->json(['message' => 'Status updated.', 'status' => $prospect->fresh()->status]);
    }

    /** POST /agent/crm/activities — log a call, visit, message… against an owner. */
    public function storeActivity(Request $request, CrmController $web): JsonResponse
    {
        $message = $this->webWrite(fn () => $web->storeActivity($request), 'Contact logged.');

        return response()->json(['message' => $message], 201);
    }

    /** POST /agent/crm/prospects/{prospect}/pipeline — turn a warm owner into a seller lead. */
    public function sendToPipeline(Request $request, CrmProspect $prospect, CrmController $web): JsonResponse
    {
        $message = $this->webWrite(fn () => $web->sendToPipeline($request, $prospect), 'Added to your pipeline.');

        return response()->json(['message' => $message], 201);
    }

    /* ---------- WhatsApp inbox ---------- */

    /** GET /agent/crm/whatsapp — account status, chat threads, campaigns. */
    public function whatsapp(Request $request, WhatsAppController $web): JsonResponse
    {
        return $this->inertiaJson($request, $web->index($request));
    }

    /** GET /agent/crm/whatsapp/chat?phone= — one conversation. */
    public function whatsappChat(Request $request, WhatsAppController $web): JsonResponse
    {
        return $this->inertiaJson($request, $web->chat($request));
    }

    /** POST /agent/crm/whatsapp/chat {phone, body} — free-text reply (inside WhatsApp's 24-hour window). */
    public function whatsappReply(Request $request, WhatsAppController $web): JsonResponse
    {
        $this->webWrite(fn () => $web->reply($request));

        return response()->json(['message' => 'Sent.'], 201);
    }
}
