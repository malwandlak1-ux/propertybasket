<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Notifications\PrivacyRequestSubmitted;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Inertia\Inertia;
use Inertia\Response;

class LegalController extends Controller
{
    /** Inbox the Information Officer monitors for POPIA requests. */
    private const INFORMATION_OFFICER = 'info@propertybasket.co.za';

    /** Common metadata shared with every legal page. */
    private function commonProps(): array
    {
        return [
            'last_updated'        => '30 May 2026',
            'effective_date'      => '01 June 2026',
            'company_name'        => 'Property Basket (Pty) Ltd',
            'jurisdiction'        => 'Republic of South Africa',
            'information_officer' => self::INFORMATION_OFFICER,
            'support_email'       => 'support@propertybasket.co.za',
            'support_phone'       => '+27 61 586 8633',
        ];
    }

    public function privacyPolicy(): Response
    {
        return Inertia::render('Public/Legal/PrivacyPolicy', [
            'meta' => $this->commonProps(),
        ]);
    }

    public function privacyPortal(): Response
    {
        return Inertia::render('Public/Legal/PrivacyPortal', [
            'meta' => $this->commonProps(),
        ]);
    }

    public function termsAndConditions(): Response
    {
        return Inertia::render('Public/Legal/TermsAndConditions', [
            'meta' => $this->commonProps(),
        ]);
    }

    /**
     * POST /privacy-portal — visitor submits a POPIA right request.
     */
    public function submitPrivacyRequest(Request $request): RedirectResponse
    {
        // Honeypot — same anti-bot pattern as the demo form.
        if ($request->filled('website')) {
            return back()->with('success', 'Thanks — your request has been recorded.');
        }

        $data = $request->validate([
            'name'         => ['required', 'string', 'min:2', 'max:120'],
            'email'        => ['required', 'email', 'max:180'],
            'request_type' => ['required', 'string', 'in:access,correction,deletion,objection,portability,other'],
            'details'      => ['nullable', 'string', 'max:3000'],
        ]);

        Notification::route('mail', self::INFORMATION_OFFICER)->notify(
            new PrivacyRequestSubmitted(
                requesterName:  $data['name'],
                requesterEmail: $data['email'],
                requestType:    $data['request_type'],
                details:        $data['details'] ?? null,
            )
        );

        return back()->with(
            'success',
            'Thanks — your request has been logged. The Information Officer will acknowledge within 3 business days and respond fully within 30 days as required by POPIA.'
        );
    }
}
