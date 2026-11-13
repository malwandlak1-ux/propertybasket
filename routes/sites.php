<?php

use App\Http\Controllers\Site\SiteController;
use App\Http\Middleware\ResolveAgencySite;
use Illuminate\Support\Facades\Route;

/*
| Agency websites — included at the top of routes/web.php so these
| host-constrained routes win over the portal's routes on the same paths.
|
| {site_host} matches any host EXCEPT the platform's own (config/sites.php
| main_hosts), i.e. "{subdomain}.{base_domain}" or an agency's custom domain.
| ResolveAgencySite turns the host into an AgencyWebsite (or 404s).
*/

if (! config('sites.enabled')) {
    return;
}

$mainHosts = implode('|', array_map(fn ($h) => preg_quote(strtolower($h), '#'), config('sites.main_hosts')));

Route::domain('{site_host}')
    ->where(['site_host' => "(?!(?:{$mainHosts})$)[a-z0-9.-]+"])
    ->middleware(ResolveAgencySite::class)
    ->name('site.')
    ->group(function () {
        Route::get('/', [SiteController::class, 'home'])->name('home');
        Route::get('/properties', [SiteController::class, 'listingsIndex'])->name('properties.index');
        Route::get('/properties/{slug}', [SiteController::class, 'listingShow'])->name('properties.show');
        Route::get('/agents', [SiteController::class, 'agentsIndex'])->name('agents.index');
        Route::get('/agents/{slug}', [SiteController::class, 'agentShow'])->name('agents.show');
        Route::get('/about', [SiteController::class, 'about'])->name('about');
        Route::get('/contact', [SiteController::class, 'contact'])->name('contact');
        Route::get('/sitemap.xml', [SiteController::class, 'sitemap'])->name('sitemap');
        Route::get('/robots.txt', [SiteController::class, 'robots'])->name('robots');

        Route::post('/inquiries', [SiteController::class, 'inquiry'])->middleware('throttle:10,1')->name('inquiries.store');
        Route::post('/contact', [SiteController::class, 'contactSubmit'])->middleware('throttle:10,1')->name('contact.store');
        Route::post('/tour-requests', [SiteController::class, 'tourRequest'])->middleware('throttle:10,1')->name('tour-requests.store');

        // Nothing else from the platform (login, dashboards, portal pages) is
        // served on an agency's domain.
        Route::any('/{any}', fn () => abort(404))->where('any', '.*')->name('fallback');
    });
