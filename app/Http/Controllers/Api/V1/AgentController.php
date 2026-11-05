<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Agent\DashboardController;
use App\Http\Controllers\Agent\ListingsController;
use App\Http\Controllers\Agent\PipelineController;
use App\Http\Controllers\Api\V1\Concerns\RendersInertiaJson;
use App\Http\Controllers\Controller;
use App\Models\Inquiry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Mobile API for the agent role — same delegation pattern as TenantController.
 */
class AgentController extends Controller
{
    use RendersInertiaJson;

    public function overview(Request $request, DashboardController $web): JsonResponse
    {
        return $this->inertiaJson($request, $web->overview($request));
    }

    public function pipeline(Request $request, PipelineController $web): JsonResponse
    {
        return $this->inertiaJson($request, $web->index($request));
    }

    public function listings(Request $request, ListingsController $web): JsonResponse
    {
        return $this->inertiaJson($request, $web->index($request));
    }

    public function storeLead(Request $request, PipelineController $web): JsonResponse
    {
        $request->headers->set('referer', url('/'));
        $web->storeLead($request);

        return response()->json(['message' => 'Lead added to your pipeline.'], 201);
    }

    public function updateLeadStatus(Request $request, Inquiry $inquiry, PipelineController $web): JsonResponse
    {
        $web->updateLeadStatus($request, $inquiry);

        return response()->json(['message' => 'Lead status updated.']);
    }
}
