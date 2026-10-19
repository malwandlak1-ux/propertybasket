<?php

/*
|--------------------------------------------------------------------------
| Integration API v1  —  /api/integration/v1/...
|--------------------------------------------------------------------------
| Read-only access to a landlord's properties, leases and financial
| statements for another system. Authenticate with a landlord API key
| (Settings → API access):  Authorization: Bearer pbk_...
| Loaded by AppServiceProvider (separate from routes/api.php).
*/

use App\Http\Controllers\Integration\StatementsController;
use Illuminate\Support\Facades\Route;

Route::get('properties',               [StatementsController::class, 'properties'])->name('properties');
Route::get('leases',                   [StatementsController::class, 'leases'])->name('leases');
Route::get('leases/{lease}/statement',     [StatementsController::class, 'tenant'])->whereNumber('lease')->name('leases.statement');
Route::get('leases/{lease}/statement.pdf', [StatementsController::class, 'tenantPdf'])->whereNumber('lease')->name('leases.statement.pdf');
Route::get('statements/owner',         [StatementsController::class, 'owner'])->name('statements.owner');
Route::get('statements/owner/monthly', [StatementsController::class, 'ownerMonthly'])->name('statements.owner.monthly');
Route::get('statements/owner.pdf',     [StatementsController::class, 'ownerPdf'])->name('statements.owner.pdf');
Route::get('operations',               [StatementsController::class, 'operations'])->name('operations');
Route::get('operations/monthly',       [StatementsController::class, 'operationsMonthly'])->name('operations.monthly');
Route::get('operations.csv',           [StatementsController::class, 'operationsCsv'])->name('operations.csv');
