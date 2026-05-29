<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\EnsuresSuperAdmin;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Inertia\Inertia;
use Inertia\Response;

class AnnouncementsController extends Controller
{
    use EnsuresSuperAdmin;

    public function index(Request $request): Response
    {
        $this->ensureSuperAdmin($request);

        // Stubbed recent announcements. Real implementation would query an
        // `announcements` table (model + migration to be added in Phase 9).
        $recent = [
            [
                'id'         => 1,
                'title'      => 'New: Move-out comparison tool',
                'audience'   => 'all',
                'audience_label' => 'All users',
                'sent_at_ago'=> '2 days ago',
                'reached'    => 4_820,
                'highlighted'=> true,
            ],
            [
                'id'         => 2,
                'title'      => 'FFC renewal reminder',
                'audience'   => 'agency_admin',
                'audience_label' => 'Agencies',
                'sent_at_ago'=> '1 week ago',
                'reached'    => 38,
                'highlighted'=> false,
            ],
            [
                'id'         => 3,
                'title'      => 'Paystack maintenance window',
                'audience'   => 'all',
                'audience_label' => 'Everyone',
                'sent_at_ago'=> '2 weeks ago',
                'reached'    => 4_790,
                'highlighted'=> false,
            ],
            [
                'id'         => 4,
                'title'      => 'Welcome to Property Basket 2.0',
                'audience'   => 'all',
                'audience_label' => 'Everyone',
                'sent_at_ago'=> '1 month ago',
                'reached'    => 0,
                'highlighted'=> false,
            ],
        ];

        $audiences = [
            ['key' => 'all',          'label' => 'Everyone',     'estimated_reach' => 4_820],
            ['key' => 'agency_admin', 'label' => 'Agencies',     'estimated_reach' => 38],
            ['key' => 'landlord',     'label' => 'Landlords',    'estimated_reach' => 214],
            ['key' => 'contractor',   'label' => 'Contractors',  'estimated_reach' => 142],
            ['key' => 'tenant',       'label' => 'Tenants',      'estimated_reach' => 4_412],
        ];

        return Inertia::render('Admin/Announcements', [
            'counts'    => $this->sidebarCounts(),
            'recent'    => $recent,
            'audiences' => $audiences,
        ]);
    }

    public function store(Request $request): \Illuminate\Http\RedirectResponse
    {
        $this->ensureSuperAdmin($request);

        $request->validate([
            'title'      => 'required|string|max:140',
            'message'    => 'required|string|max:2000',
            'audience'   => 'required|string|in:all,agency_admin,landlord,contractor,tenant,agent',
            'in_app'     => 'boolean',
            'by_email'   => 'boolean',
        ]);

        // Stub: a real implementation would persist + dispatch a broadcast job.
        // For now we just flash a message and bounce back.
        return back()->with('status', 'Announcement queued for broadcast (stub).');
    }
}
