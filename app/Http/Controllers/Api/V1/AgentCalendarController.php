<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Agent\ViewingsController;
use App\Http\Controllers\Api\V1\Concerns\RendersInertiaJson;
use App\Http\Controllers\Controller;
use App\Models\AgentReminder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Mobile API for the agent Calendar tab (viewings + reminders). Delegates to
 * the web ViewingsController so the app and the site share one code path;
 * validation errors surface as 422 JSON because the request expects JSON.
 */
class AgentCalendarController extends Controller
{
    use RendersInertiaJson;

    /** GET /api/v1/agent/calendar?view=day|week|month&cursor=Y-m-d */
    public function index(Request $request, ViewingsController $web): JsonResponse
    {
        return $this->inertiaJson($request, $web->index($request));
    }

    /** POST /api/v1/agent/calendar/viewings */
    public function storeViewing(Request $request, ViewingsController $web): JsonResponse
    {
        $web->store($request);

        return response()->json(['message' => 'Viewing scheduled.'], 201);
    }

    /** POST /api/v1/agent/calendar/reminders */
    public function storeReminder(Request $request, ViewingsController $web): JsonResponse
    {
        $web->storeReminder($request);

        return response()->json(['message' => 'Reminder set.'], 201);
    }

    /** PATCH /api/v1/agent/calendar/reminders/{reminder} — toggle done. */
    public function toggleReminder(Request $request, AgentReminder $reminder, ViewingsController $web): JsonResponse
    {
        $web->toggleReminder($request, $reminder);

        return response()->json(['done' => $reminder->fresh()->done_at !== null]);
    }

    /** DELETE /api/v1/agent/calendar/reminders/{reminder} */
    public function destroyReminder(Request $request, AgentReminder $reminder, ViewingsController $web): JsonResponse
    {
        $web->destroyReminder($request, $reminder);

        return response()->json(['message' => 'Reminder deleted.']);
    }
}
