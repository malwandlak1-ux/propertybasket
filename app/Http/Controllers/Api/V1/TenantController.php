<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\RendersInertiaJson;
use App\Http\Controllers\Controller;
use App\Http\Controllers\Tenant\DashboardController;
use App\Http\Controllers\Tenant\LeaseController;
use App\Http\Controllers\Tenant\MaintenanceController;
use App\Http\Controllers\Tenant\PaymentsController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Mobile API for the tenant role. Every GET endpoint delegates to the
 * existing web controller and returns its Inertia page props as JSON, so the
 * app and the website always agree. Mutations call the same web actions and
 * discard the redirect in favour of a JSON envelope.
 */
class TenantController extends Controller
{
    use RendersInertiaJson;

    public function overview(Request $request, DashboardController $web): JsonResponse
    {
        return $this->inertiaJson($request, $web->overview($request));
    }

    public function payments(Request $request, PaymentsController $web): JsonResponse
    {
        return $this->inertiaJson($request, $web->index($request));
    }

    public function lease(Request $request, LeaseController $web): JsonResponse
    {
        return $this->inertiaJson($request, $web->index($request));
    }

    public function maintenance(Request $request, MaintenanceController $web): JsonResponse
    {
        return $this->inertiaJson($request, $web->index($request));
    }

    public function storeMaintenance(Request $request, MaintenanceController $web): JsonResponse
    {
        // The web action redirects back() on success; give it a deterministic
        // referer so no session lookup is attempted, then answer with JSON.
        $request->headers->set('referer', url('/'));
        $web->store($request);

        return response()->json(['message' => 'Maintenance request submitted.'], 201);
    }
}
