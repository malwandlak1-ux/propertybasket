<?php

use App\Http\Controllers\Api\V1\AgentCalendarController;
use App\Http\Controllers\Api\V1\AgentController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\PushTokenController;
use App\Http\Controllers\Api\V1\TenantController;
use App\Http\Middleware\EnsureRoleEnabled;
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

        Route::post('push-tokens',   [PushTokenController::class, 'store']);
        Route::delete('push-tokens', [PushTokenController::class, 'destroy']);

        Route::prefix('tenant')->group(function () {
            Route::get('overview',     [TenantController::class, 'overview']);
            Route::get('payments',     [TenantController::class, 'payments']);
            Route::get('lease',        [TenantController::class, 'lease']);
            Route::get('maintenance',  [TenantController::class, 'maintenance']);
            Route::post('maintenance', [TenantController::class, 'storeMaintenance']);
        });

        // Same role switch + FFC compliance gate as the web agent routes (FFC blocks writes only).
        Route::prefix('agent')->middleware([EnsureRoleEnabled::class . ':agent', 'ffc'])->group(function () {
            Route::get('overview',  [AgentController::class, 'overview']);
            Route::get('pipeline',  [AgentController::class, 'pipeline']);
            Route::get('listings',  [AgentController::class, 'listings']);
            Route::post('pipeline/leads', [AgentController::class, 'storeLead']);
            Route::patch('pipeline/leads/{inquiry}/status', [AgentController::class, 'updateLeadStatus']);
            Route::patch('pipeline/leads/{inquiry}/viewing', [AgentController::class, 'scheduleLeadViewing']);

            Route::get('messages',                  [AgentController::class, 'messages']);
            Route::post('messages/{conversation}',  [AgentController::class, 'sendMessage']);

            Route::get('tenants',     [AgentController::class, 'tenants']);
            Route::get('maintenance', [AgentController::class, 'maintenance']);
            Route::get('commission',  [AgentController::class, 'commission']);
            Route::get('analytics',   [AgentController::class, 'analytics']);
            Route::get('inspections', [AgentController::class, 'inspections']);
            Route::get('ffc',         [AgentController::class, 'ffc']);
            Route::get('settings',    [AgentController::class, 'settings']);
            Route::get('crm',         [AgentController::class, 'crm']);

            Route::get('calendar',                         [AgentCalendarController::class, 'index']);
            Route::post('calendar/viewings',               [AgentCalendarController::class, 'storeViewing']);
            Route::post('calendar/reminders',              [AgentCalendarController::class, 'storeReminder']);
            Route::patch('calendar/reminders/{reminder}',  [AgentCalendarController::class, 'toggleReminder']);
            Route::delete('calendar/reminders/{reminder}', [AgentCalendarController::class, 'destroyReminder']);
        });
    });
});
