<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Notifications\DemoRequested;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;

class DemoRequestController extends Controller
{
    /**
     * Where leads land. Hardcoded for now; promote to a setting later when
     * the team wants to fan-out to multiple inboxes.
     */
    private const LEAD_INBOX = 'info@propertybasket.co.za';

    public function store(Request $request): RedirectResponse
    {
        // Honeypot: real users won't fill this hidden field; bots will. If
        // populated, swallow the request silently so we don't tip them off.
        if ($request->filled('website')) {
            return back()->with('success', 'Thanks — we\'ll be in touch soon.');
        }

        $data = $request->validate([
            'name'    => ['required', 'string', 'min:2', 'max:120'],
            'email'   => ['required', 'email', 'max:180'],
            'phone'   => ['required', 'string', 'min:6', 'max:30'],
            'message' => ['nullable', 'string', 'max:2000'],
        ]);

        Notification::route('mail', self::LEAD_INBOX)->notify(
            new DemoRequested(
                visitorName:    $data['name'],
                visitorEmail:   $data['email'],
                visitorPhone:   $data['phone'],
                visitorMessage: $data['message'] ?? null,
            )
        );

        return back()->with(
            'success',
            'Thanks ' . explode(' ', $data['name'])[0] . " — we'll be in touch shortly!"
        );
    }
}
