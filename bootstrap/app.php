<?php

use App\Http\Middleware\EnsureValidAgencyFfc;
use App\Http\Middleware\EnsureValidFfc;
use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [
            HandleInertiaRequests::class,
        ]);
        $middleware->alias([
            'ffc'        => EnsureValidFfc::class,
            'agency_ffc' => EnsureValidAgencyFfc::class,
        ]);
        // Paystack signs its webhooks via HMAC — CSRF cookie isn't applicable.
        $middleware->validateCsrfTokens(except: [
            'webhooks/paystack',
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
