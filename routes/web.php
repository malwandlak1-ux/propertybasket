<?php

use App\Http\Controllers\Admin;
use App\Http\Controllers\Agency\DashboardController as AgencyDashboardController;
use App\Http\Controllers\Agent;
use App\Http\Controllers\Contractor;
use App\Http\Controllers\Landlord;
use App\Http\Controllers\Tenant;
use App\Http\Controllers\Auth\InvitationController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\ContractorController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\Public\AdviceController;
use App\Http\Controllers\Public\AgencyController;
use App\Http\Controllers\Public\CalculatorController;
use App\Http\Controllers\Public\DemoRequestController;
use App\Http\Controllers\Public\HomeController;
use App\Http\Controllers\Public\InquiryController;
use App\Http\Controllers\Public\TourRequestController;
use App\Http\Controllers\Public\LegalController;
use App\Http\Controllers\Public\ListingController;
use Illuminate\Support\Facades\Route;

// Public
Route::get('/', HomeController::class)->name('home');
Route::get('/properties', [ListingController::class, 'index'])->name('properties.index');
Route::get('/properties/{slug}', [ListingController::class, 'show'])->name('properties.show');
Route::post('/inquiries', [InquiryController::class, 'store'])->name('inquiries.store');
Route::post('/tour-requests', [TourRequestController::class, 'store'])->name('tour-requests.store');
Route::get('/agencies', [AgencyController::class, 'index'])->name('agencies.index');
Route::get('/agencies/{slug}', [AgencyController::class, 'show'])->name('agencies.show');
Route::get('/advice', [AdviceController::class, 'index'])->name('advice.index');
Route::get('/advice/{slug}', [AdviceController::class, 'show'])->name('advice.show');
Route::get('/calculator', CalculatorController::class)->name('calculator');
Route::post('/demos', [DemoRequestController::class, 'store'])->name('demos.store');

// Marketing overview — serves the self-contained landing page (workflow videos embedded).
Route::get('/overview', function () {
    abort_unless(is_file(public_path('property-basket-overview.html')), 404);
    return response()->file(public_path('property-basket-overview.html'));
})->name('overview');

Route::get('/privacy-policy',         [LegalController::class, 'privacyPolicy'])->name('legal.privacy');
Route::get('/privacy-portal',         [LegalController::class, 'privacyPortal'])->name('legal.privacyPortal');
Route::post('/privacy-portal',        [LegalController::class, 'submitPrivacyRequest'])->name('legal.privacyPortal.submit');
Route::get('/terms-and-conditions',   [LegalController::class, 'termsAndConditions'])->name('legal.terms');

// Paystack webhook (no auth, no CSRF — verified via HMAC signature)
Route::post('/webhooks/paystack', [\App\Http\Controllers\Payments\PaystackController::class, 'webhook'])
    ->name('webhooks.paystack');

// Paystack browser callback (after user returns from hosted checkout)
Route::get('/payments/paystack/callback', [\App\Http\Controllers\Payments\PaystackController::class, 'callback'])
    ->middleware('auth')
    ->name('payments.paystack.callback');

// Guest auth
Route::middleware('guest')->group(function () {
    Route::get('login', [LoginController::class, 'create'])->name('login');
    Route::post('login', [LoginController::class, 'store']);

    Route::get('register', [RegisterController::class, 'create'])->name('register');
    Route::post('register', [RegisterController::class, 'store']);

    Route::get('invite/{token}', [InvitationController::class, 'show'])->name('invite.show');
    Route::post('invite/{token}', [InvitationController::class, 'accept'])->name('invite.accept');
});

// Authenticated
Route::middleware('auth')->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');
    Route::post('logout', [LoginController::class, 'destroy'])->name('logout');
    Route::get('contractors', [ContractorController::class, 'index'])->name('contractors.index');

    Route::post('notifications/{id}/read', [\App\Http\Controllers\NotificationsController::class, 'markRead'])->name('notifications.read');
    Route::post('notifications/read-all',  [\App\Http\Controllers\NotificationsController::class, 'markAllRead'])->name('notifications.read-all');

    // Subscription paywall (agencies & landlords). Reachable while unsubscribed —
    // must NOT sit behind the `subscribed` gate or it would loop.
    Route::get('billing/select',   [\App\Http\Controllers\Billing\SubscriptionController::class, 'select'])->name('billing.select');
    Route::post('billing/checkout',[\App\Http\Controllers\Billing\SubscriptionController::class, 'checkout'])->name('billing.checkout');
    Route::post('billing/promo',   [\App\Http\Controllers\Billing\SubscriptionController::class, 'applyPromo'])->name('billing.promo');
    Route::get('billing/callback', [\App\Http\Controllers\Billing\SubscriptionController::class, 'callback'])->name('billing.callback');

    Route::prefix('agency')->name('agency.')->middleware('subscribed')->group(function () {
        Route::get('/', [AgencyDashboardController::class, 'overview'])->name('overview');

        Route::get('agents', [\App\Http\Controllers\Agency\AgentsController::class, 'index'])->name('agents.index');
        Route::post('agents/invite', [\App\Http\Controllers\Agency\AgentsController::class, 'invite'])->name('agents.invite');

        Route::get('tenants', [\App\Http\Controllers\Agency\TenantsController::class, 'index'])->name('tenants.index');

        Route::get('contractors',  [\App\Http\Controllers\Agency\ContractorsController::class, 'index'])->name('contractors.index');
        Route::post('contractors', [\App\Http\Controllers\Agency\ContractorsController::class, 'store'])->name('contractors.store');

        Route::get('trust-account',   [\App\Http\Controllers\Agency\TrustAccountController::class, 'show'])->name('trust-account.show');
        Route::patch('trust-account', [\App\Http\Controllers\Agency\TrustAccountController::class, 'update'])->name('trust-account.update');

        Route::get('compliance',              [\App\Http\Controllers\Agency\EaabController::class, 'show'])->name('compliance.show');
        Route::post('compliance',             [\App\Http\Controllers\Agency\EaabController::class, 'update'])->name('compliance.update');
        Route::get('compliance/certificate',  [\App\Http\Controllers\Agency\EaabController::class, 'certificate'])->name('compliance.certificate');

        Route::get('billing',         [\App\Http\Controllers\Agency\BillingController::class, 'show'])->name('billing.show');
        Route::post('billing/switch', [\App\Http\Controllers\Agency\BillingController::class, 'switch'])->name('billing.switch');

        Route::get('maintenance',                         [\App\Http\Controllers\Agency\MaintenanceController::class, 'index'])->name('maintenance.index');
        Route::post('maintenance/{maintenanceRequest}/assign',      [\App\Http\Controllers\Agency\MaintenanceController::class, 'assign'])->name('maintenance.assign');
        Route::post('maintenance/{maintenanceRequest}/marketplace', [\App\Http\Controllers\Agency\MaintenanceController::class, 'marketplace'])->name('maintenance.marketplace');
        Route::post('maintenance/{maintenanceRequest}/rate',        [\App\Http\Controllers\Agency\MaintenanceController::class, 'rate'])->name('maintenance.rate');
        Route::get('maintenance/quotes',                  [\App\Http\Controllers\Agency\QuotesController::class, 'index'])->name('maintenance.quotes.index');
        Route::post('maintenance/quotes/{quote}/accept',  [\App\Http\Controllers\Agency\QuotesController::class, 'accept'])->name('maintenance.quotes.accept');
        Route::post('maintenance/quotes/{quote}/reject',  [\App\Http\Controllers\Agency\QuotesController::class, 'reject'])->name('maintenance.quotes.reject');

        Route::get('commissions', [\App\Http\Controllers\Agency\CommissionController::class, 'index'])->name('commissions.index');
        Route::post('commissions/approve', [\App\Http\Controllers\Agency\CommissionController::class, 'approve'])->name('commissions.approve');
        Route::post('commissions/payout', [\App\Http\Controllers\Agency\CommissionController::class, 'runPayout'])->name('commissions.payout');
        Route::post('commissions/invoices/{invoice}/pay', [\App\Http\Controllers\Agency\CommissionController::class, 'payInvoice'])->name('commissions.invoices.pay');
        Route::post('commissions/rates', [\App\Http\Controllers\Agency\CommissionController::class, 'updateRates'])->name('commissions.rates');

        Route::get('landlords',  [\App\Http\Controllers\Agency\LandlordsController::class, 'index'])->name('landlords.index');
        Route::post('landlords', [\App\Http\Controllers\Agency\LandlordsController::class, 'storeLandlord'])->name('landlords.store');
        Route::patch('landlords/{managedLandlord}',  [\App\Http\Controllers\Agency\LandlordsController::class, 'updateLandlord'])->name('landlords.update');
        Route::delete('landlords/{managedLandlord}', [\App\Http\Controllers\Agency\LandlordsController::class, 'destroyLandlord'])->name('landlords.destroy');
        Route::post('landlords/link-property',        [\App\Http\Controllers\Agency\LandlordsController::class, 'linkProperty'])->name('landlords.link');
        Route::post('landlords/properties/{listing}/unlink', [\App\Http\Controllers\Agency\LandlordsController::class, 'unlinkProperty'])->name('landlords.unlink');
        Route::post('landlords/run-payout',           [\App\Http\Controllers\Agency\LandlordsController::class, 'runMonthlyPayout'])->name('landlords.payout');

        Route::get('settings', [\App\Http\Controllers\Agency\SettingsController::class, 'show'])->name('settings.show');
        Route::match(['post', 'patch'], 'settings', [\App\Http\Controllers\Agency\SettingsController::class, 'update'])->name('settings.update');

        Route::get('pipeline', [\App\Http\Controllers\Agency\PipelineController::class, 'index'])->name('pipeline.index');
        Route::post('pipeline/leads/{inquiry}/register', [\App\Http\Controllers\Agency\PipelineController::class, 'register'])->name('pipeline.leads.register');

        Route::get('listings', [\App\Http\Controllers\Agency\ListingsAllocationController::class, 'index'])->name('listings.index');
        Route::get('listings/create', [\App\Http\Controllers\Agency\ListingsController::class, 'create'])->name('listings.create');

        Route::middleware('agency_ffc')->group(function () {
            Route::post('listings', [\App\Http\Controllers\Agency\ListingsController::class, 'store'])->name('listings.store');
            Route::post('listings/{listing}/assign', [\App\Http\Controllers\Agency\ListingsAllocationController::class, 'assignListing'])->name('listings.assign');
            Route::post('listings/{listing}/auto-assign', [\App\Http\Controllers\Agency\ListingsAllocationController::class, 'autoAssignListing'])->name('listings.auto-assign');
            Route::post('leads/{inquiry}/reassign', [\App\Http\Controllers\Agency\ListingsAllocationController::class, 'reassignLead'])->name('leads.reassign');
        });

        Route::get('reports', [\App\Http\Controllers\Agency\ReportsController::class, 'index'])->name('reports.index');

        Route::get('messages', [\App\Http\Controllers\Agency\MessagesController::class, 'index'])->name('messages.index');
        Route::post('messages/{conversation}', [\App\Http\Controllers\Agency\MessagesController::class, 'store'])->name('messages.store');
        Route::post('messages-broadcast', [\App\Http\Controllers\Agency\MessagesController::class, 'broadcast'])->name('messages.broadcast');
    });

    Route::prefix('agent')->name('agent.')->middleware('ffc')->group(function () {
        Route::get('ffc',         [Agent\FfcController::class, 'index'])->name('ffc.index');
        Route::post('ffc',        [Agent\FfcController::class, 'update'])->name('ffc.update');
        Route::get('ffc/certificate', [Agent\FfcController::class, 'certificate'])->name('ffc.certificate');
        Route::get('/',           [Agent\DashboardController::class, 'overview'])->name('overview');
        Route::get('pipeline',    [Agent\PipelineController::class,  'index'])->name('pipeline.index');
        Route::post('pipeline/leads', [Agent\PipelineController::class, 'storeLead'])->name('pipeline.leads.store');
        Route::patch('pipeline/leads/{inquiry}/status', [Agent\PipelineController::class, 'updateLeadStatus'])->name('pipeline.leads.status');
        Route::get('listings',    [Agent\ListingsController::class,  'index'])->name('listings.index');
        Route::get('listings/create', [Agent\ListingsController::class, 'create'])->name('listings.create');
        Route::get('listings/{listing}/edit', [Agent\ListingsController::class, 'edit'])->name('listings.edit');

        Route::middleware('agency_ffc')->group(function () {
            Route::post('listings',                          [Agent\ListingsController::class, 'store'])->name('listings.store');
            Route::post('listings/{listing}',                [Agent\ListingsController::class, 'update'])->name('listings.update');
            Route::post('listings/{listing}/invite-tenant',  [Agent\ListingsController::class, 'inviteTenant'])->name('listings.invite-tenant');
            Route::post('listings/{listing}/reactivate',     [Agent\ListingsController::class, 'reactivate'])->name('listings.reactivate');
            Route::post('listings/{listing}/mark-sold',      [Agent\ListingsController::class, 'markSold'])->name('listings.mark-sold');
        });
        Route::get('viewings',    [Agent\ViewingsController::class,  'index'])->name('viewings.index');
        Route::post('viewings',   [Agent\ViewingsController::class,  'store'])->name('viewings.store');
        Route::get('maintenance', [Agent\MaintenanceController::class, 'index'])->name('maintenance.index');

        Route::get('inspections', [Agent\InspectionsController::class, 'index'])->name('inspections.index');
        Route::get('inspections/create', [Agent\InspectionsController::class, 'create'])->name('inspections.create');
        Route::post('inspections', [Agent\InspectionsController::class, 'store'])->name('inspections.store');
        Route::get('inspections/{inspection}', [Agent\InspectionsController::class, 'show'])->name('inspections.show');
        Route::get('inspections/{inspection}/pdf', [Agent\InspectionsController::class, 'download'])->name('inspections.download');
        Route::get('messages',    [Agent\MessagesController::class,  'index'])->name('messages.index');
        Route::post('messages/{conversation}', [Agent\MessagesController::class, 'store'])->name('messages.store');
        Route::get('commission',  [Agent\CommissionController::class, 'index'])->name('commission.index');
        Route::get('analytics',   [Agent\AnalyticsController::class, 'index'])->name('analytics.index');
        Route::get('tenants',     [Agent\TenantsController::class,   'index'])->name('tenants.index');
        Route::get('settings',    [Agent\SettingsController::class,  'index'])->name('settings.index');
        Route::post('settings/profile',       [Agent\SettingsController::class, 'updateProfile'])->name('settings.profile');
        Route::post('settings/password',      [Agent\SettingsController::class, 'updatePassword'])->name('settings.password');
        Route::post('settings/notifications', [Agent\SettingsController::class, 'updateNotifications'])->name('settings.notifications');
        Route::post('settings/banking',       [Agent\SettingsController::class, 'updateBanking'])->name('settings.banking');
    });

    Route::prefix('admin')->name('admin.')->group(function () {
        Route::get('/',              [Admin\OverviewController::class,      'index'])->name('overview');
        Route::get('overview.pdf',   [Admin\OverviewController::class,      'exportPdf'])->name('overview.pdf');
        Route::get('agencies',       [Admin\AgenciesController::class,      'index'])->name('agencies.index');
        Route::post('agencies/{agency}/approve',      [Admin\AgenciesController::class, 'approve'])->name('agencies.approve');
        Route::post('agencies/{agency}/suspend',      [Admin\AgenciesController::class, 'suspend'])->name('agencies.suspend');
        Route::post('agencies/{agency}/reactivate',   [Admin\AgenciesController::class, 'reactivate'])->name('agencies.reactivate');
        Route::post('agencies/{agency}/verify-eaab',  [Admin\AgenciesController::class, 'verifyEaab'])->name('agencies.verifyEaab');
        Route::get('landlords',      [Admin\LandlordsController::class,     'index'])->name('landlords.index');
        Route::post('landlords/{landlord}/verify-fica', [Admin\LandlordsController::class, 'verifyFica'])->name('landlords.verifyFica');
        Route::post('landlords/{landlord}/activate',    [Admin\LandlordsController::class, 'activate'])->name('landlords.activate');
        Route::post('landlords/{landlord}/suspend',     [Admin\LandlordsController::class, 'suspend'])->name('landlords.suspend');
        Route::get('contractors',    [Admin\ContractorsController::class,   'index'])->name('contractors.index');
        Route::post('contractors/{contractor}/verify',   [Admin\ContractorsController::class, 'verifyDocument'])->name('contractors.verify');
        Route::post('contractors/{contractor}/activate', [Admin\ContractorsController::class, 'activate'])->name('contractors.activate');
        Route::post('contractors/{contractor}/suspend',  [Admin\ContractorsController::class, 'suspend'])->name('contractors.suspend');
        Route::get('users',          [Admin\UsersController::class,         'index'])->name('users.index');
        Route::post('users/{user}/activate', [Admin\UsersController::class, 'activate'])->name('users.activate');
        Route::post('users/{user}/suspend',  [Admin\UsersController::class, 'suspend'])->name('users.suspend');
        Route::delete('users/{user}',        [Admin\UsersController::class, 'destroy'])->name('users.destroy');
        Route::get('roles',          [Admin\RolesController::class,         'index'])->name('roles.index');
        Route::post('roles/save',           [Admin\RolesController::class, 'save'])->name('roles.save');
        Route::post('roles/reset',          [Admin\RolesController::class, 'reset'])->name('roles.reset');
        Route::post('roles/new-role',       [Admin\RolesController::class, 'createRole'])->name('roles.createRole');
        Route::delete('roles/{roleKey}',    [Admin\RolesController::class, 'deleteRole'])->name('roles.deleteRole');
        Route::get('subscriptions',  [Admin\SubscriptionsController::class, 'index'])->name('subscriptions.index');
        Route::patch('subscriptions/{key}', [Admin\SubscriptionsController::class, 'update'])->name('subscriptions.update');
        Route::get('promo-codes',                 [Admin\PromoCodesController::class, 'index'])->name('promo-codes.index');
        Route::post('promo-codes',                [Admin\PromoCodesController::class, 'store'])->name('promo-codes.store');
        Route::patch('promo-codes/{promoCode}/toggle', [Admin\PromoCodesController::class, 'toggle'])->name('promo-codes.toggle');
        Route::delete('promo-codes/{promoCode}',  [Admin\PromoCodesController::class, 'destroy'])->name('promo-codes.destroy');
        Route::get('transactions',         [Admin\TransactionsController::class, 'index'])->name('transactions.index');
        Route::get('transactions/export',  [Admin\TransactionsController::class, 'export'])->name('transactions.export');
        Route::get('announcements',  [Admin\AnnouncementsController::class, 'index'])->name('announcements.index');
        Route::post('announcements', [Admin\AnnouncementsController::class, 'store'])->name('announcements.store');
        Route::get('settings',       [Admin\SettingsController::class,      'index'])->name('settings.index');
        Route::patch('settings',     [Admin\SettingsController::class,      'update'])->name('settings.update');
        Route::post('settings/reset',[Admin\SettingsController::class,      'reset'])->name('settings.reset');
        Route::get('system',         [Admin\SystemController::class,        'index'])->name('system.index');

        Route::get('blog',                 [Admin\BlogController::class, 'index'])->name('blog.index');
        Route::get('blog/create',          [Admin\BlogController::class, 'create'])->name('blog.create');
        Route::post('blog',                [Admin\BlogController::class, 'store'])->name('blog.store');
        Route::get('blog/{post}/edit',     [Admin\BlogController::class, 'edit'])->name('blog.edit');
        Route::post('blog/{post}',         [Admin\BlogController::class, 'update'])->name('blog.update');
        Route::delete('blog/{post}',       [Admin\BlogController::class, 'destroy'])->name('blog.destroy');
    });

    Route::prefix('contractor')->name('contractor.')->group(function () {
        Route::get('/',           [Contractor\DashboardController::class, 'overview'])->name('overview');
        Route::get('requests',    [Contractor\RequestsController::class,  'index'])->name('requests.index');
        Route::post('requests/{maintenanceRequest}/accept',  [Contractor\RequestsController::class, 'accept'])->name('requests.accept');
        Route::post('requests/{maintenanceRequest}/decline', [Contractor\RequestsController::class, 'decline'])->name('requests.decline');
        Route::get('jobs',        [Contractor\JobsController::class,      'index'])->name('jobs.index');
        Route::post('jobs/{maintenanceRequest}/start',    [Contractor\JobsController::class, 'start'])->name('jobs.start');
        Route::post('jobs/{maintenanceRequest}/complete', [Contractor\JobsController::class, 'complete'])->name('jobs.complete');
        Route::get('quotes',      [Contractor\QuotesController::class,    'index'])->name('quotes.index');
        Route::post('quotes',     [Contractor\QuotesController::class,    'store'])->name('quotes.store');
        Route::get('invoices',    [Contractor\InvoicesController::class,  'index'])->name('invoices.index');
        Route::post('invoices',   [Contractor\InvoicesController::class,  'store'])->name('invoices.store');
        Route::get('invoices/{invoice}/pdf', [Contractor\InvoicesController::class, 'download'])->name('invoices.download');
        Route::get('finance',     [Contractor\FinanceController::class,   'index'])->name('finance.index');
        Route::get('messages',    [Contractor\MessagesController::class,  'index'])->name('messages.index');
        Route::post('messages/{conversation}', [Contractor\MessagesController::class, 'store'])->name('messages.store');

        Route::get('settings',                       [Contractor\SettingsController::class, 'show'])->name('settings.show');
        Route::patch('settings/profile',             [Contractor\SettingsController::class, 'updateProfile'])->name('settings.profile.update');
        Route::patch('settings/password',            [Contractor\SettingsController::class, 'updatePassword'])->name('settings.password.update');
        Route::patch('settings/banking',             [Contractor\SettingsController::class, 'updateBanking'])->name('settings.banking.update');
        Route::patch('settings/portfolio',           [Contractor\SettingsController::class, 'updatePortfolio'])->name('settings.portfolio.update');
        Route::post('settings/portfolio/photos',     [Contractor\SettingsController::class, 'uploadPortfolioPhoto'])->name('settings.portfolio.photos.store');
        Route::delete('settings/portfolio/photos/{index}', [Contractor\SettingsController::class, 'deletePortfolioPhoto'])->name('settings.portfolio.photos.destroy')->whereNumber('index');
    });

    Route::prefix('landlord')->name('landlord.')->middleware('subscribed')->group(function () {
            Route::get('/',           [Landlord\DashboardController::class,   'overview'])->name('overview');
            Route::get('properties',  [Landlord\PropertiesController::class,  'index'])->name('properties.index');
            Route::get('listings/create', [Landlord\ListingsController::class, 'create'])->name('listings.create');
            Route::post('listings',  [Landlord\ListingsController::class,    'store'])->name('listings.store');
            Route::get('tenants',     [Landlord\TenantsController::class,     'index'])->name('tenants.index');
            Route::post('listings/{listing}/invite-tenant', [Landlord\TenantsController::class, 'inviteTenant'])->name('listings.invite-tenant');
            Route::post('leases/{lease}/resend-invite',     [Landlord\TenantsController::class, 'resendInvitation'])->name('leases.resend-invite');
            Route::get('maintenance', [Landlord\MaintenanceController::class, 'index'])->name('maintenance.index');
            Route::get('finance',     [Landlord\FinanceController::class,     'index'])->name('finance.index');
            Route::get('messages',    [Landlord\MessagesController::class,    'index'])->name('messages.index');
            Route::post('messages/{conversation}', [Landlord\MessagesController::class, 'store'])->name('messages.store');

            Route::get('settings',          [Landlord\SettingsController::class, 'show'])->name('settings.show');
            Route::patch('settings/profile',[Landlord\SettingsController::class, 'updateProfile'])->name('settings.profile');
            Route::patch('settings/banking',[Landlord\SettingsController::class, 'updateBanking'])->name('settings.banking');
        });

    Route::prefix('tenant')->name('tenant.')->group(function () {
        Route::get('/',            [Tenant\DashboardController::class,   'overview'])->name('overview');
        Route::get('lease',        [Tenant\LeaseController::class,       'index'])->name('lease.index');
        Route::get('lease/agreement.pdf', [Tenant\LeaseController::class, 'agreement'])->name('lease.agreement');
        Route::post('lease/sign',  [Tenant\LeaseController::class,       'sign'])->name('lease.sign');
        Route::get('payments',     [Tenant\PaymentsController::class,    'index'])->name('payments.index');
        Route::get('payments/{payment}/receipt.pdf', [Tenant\PaymentsController::class, 'receipt'])->name('payments.receipt');
        Route::post('payments/pay', [\App\Http\Controllers\Payments\PaystackController::class, 'initialize'])->name('payments.pay');
        Route::get('maintenance',  [Tenant\MaintenanceController::class, 'index'])->name('maintenance.index');
        Route::post('maintenance', [Tenant\MaintenanceController::class, 'store'])->name('maintenance.store');
        Route::post('maintenance/{maintenanceRequest}/rate', [Tenant\MaintenanceController::class, 'rate'])->name('maintenance.rate');
        Route::get('documents',    [Tenant\DocumentsController::class,   'index'])->name('documents.index');
        Route::get('messages',     [Tenant\MessagesController::class,    'index'])->name('messages.index');
        Route::post('messages/{conversation}', [Tenant\MessagesController::class, 'store'])->name('messages.store');

        Route::post('debit-order',       [Tenant\DebitOrderController::class, 'store'])->name('debit-order.store');
        Route::post('debit-order/cancel',[Tenant\DebitOrderController::class, 'cancel'])->name('debit-order.cancel');

        Route::get('settings',           [Tenant\SettingsController::class, 'show'])->name('settings.show');
        Route::patch('settings/profile', [Tenant\SettingsController::class, 'updateProfile'])->name('settings.profile');
        Route::patch('settings/password',[Tenant\SettingsController::class, 'updatePassword'])->name('settings.password');
    });
});

// ---- LOCAL-ONLY: render any notification email as HTML for visual preview.
Route::get('/__email-preview/{notification}', function (string $notification) {
    abort_unless(app()->environment('local'), 404);

    $user = new \App\Models\User();
    $user->id    = 1;
    $user->name  = 'Malwandla Khosa';
    $user->email = 'malwandla@example.com';
    $user->role  = \App\Enums\Role::Agent;

    if ($notification === 'welcome') {
        $notif   = new \App\Notifications\WelcomeUser($user);
        $message = $notif->toMail($user);
    } elseif ($notification === 'inquiryreceived') {
        $listing = new \App\Models\Listing();
        $listing->id    = 1;
        $listing->title = '3 Bedroom Apartment in Sandton Central';
        $listing->slug  = 'sandton-central-3bed';

        $inquiry = new \App\Models\Inquiry();
        $inquiry->id      = 42;
        $inquiry->name    = 'Tshepo Khumalo';
        $inquiry->email   = 'tshepo.khumalo@example.test';
        $inquiry->phone   = '+27 82 345 6789';
        $inquiry->message = 'Hi, I\'m interested in viewing this property. Is it still available? I can come this Saturday morning.';
        $inquiry->setRelation('listing', $listing);

        $notif   = new \App\Notifications\InquiryReceived($inquiry);
        $message = $notif->toMail($user);

    } elseif ($notification === 'userinvited') {
        $invitation = new \App\Models\Invitation();
        $invitation->id         = 1;
        $invitation->email      = 'sipho@sandton-realty.test';
        $invitation->role       = 'agent';
        $invitation->token      = 'preview-token-abc123';
        $invitation->expires_at = now()->addDays(7);
        // Fake the invitedBy relation
        $inviter = new \App\Models\User();
        $inviter->id   = 2;
        $inviter->name = 'Sandton Realty';
        $invitation->setRelation('invitedBy', $inviter);

        $notif   = new \App\Notifications\UserInvited($invitation);
        $message = $notif->toMail($user);
    } else {
        abort(404);
    }

    $markdown = app(\Illuminate\Mail\Markdown::class);

    return $markdown->render($message->markdown ?? 'notifications::email', $message->data());
})->name('__email-preview');
