<?php

use App\Http\Controllers\Api\V1\AgentController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\TenantController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Mobile API (v1)
|--------------------------------------------------------------------------
| Consumed by the Property Basket mobile app (mobile/). Bearer-token auth via
| Laravel Sanctum (`auth:sanctum`), plus `active.api` to reject suspended
| accounts. GET endpoints return the exact Inertia page props the website
| renders — see RendersInertiaJson.
*/

Route::prefix('v1')->group(function () {
    Route::post('auth/login', [AuthController::class, 'login'])
        ->middleware('throttle:10,1');

    Route::middleware(['auth:sanctum', 'active.api'])->group(function () {
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::get('me', [AuthController::class, 'me']);

        Route::prefix('tenant')->group(function () {
            Route::get('overview',     [TenantController::class, 'overview']);
            Route::get('payments',     [TenantController::class, 'payments']);
            Route::get('lease',        [TenantController::class, 'lease']);
            Route::get('maintenance',  [TenantController::class, 'maintenance']);
            Route::post('maintenance', [TenantController::class, 'storeMaintenance']);
        });

        // Same FFC compliance gate as the web agent routes (writes only).
        Route::prefix('agent')->middleware('ffc')->group(function () {
            Route::get('overview',  [AgentController::class, 'overview']);
            Route::get('pipeline',  [AgentController::class, 'pipeline']);
            Route::get('listings',  [AgentController::class, 'listings']);
            Route::post('pipeline/leads', [AgentController::class, 'storeLead']);
            Route::patch('pipeline/leads/{inquiry}/status', [AgentController::class, 'updateLeadStatus']);
        });
    });
});
