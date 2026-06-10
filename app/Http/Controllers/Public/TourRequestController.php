<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\Listing;
use App\Services\InquiryService;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class TourRequestController extends Controller
{
    /**
     * POST /tour-requests — "Schedule a tour" form on the public listing page.
     * Routed through the inquiry pipeline so it reaches the agent's dashboard
     * and registered email.
     */
    public function store(Request $request, InquiryService $service): RedirectResponse
    {
        $data = $request->validate([
            'listing_id' => ['required', 'integer', 'exists:listings,id'],
            'tour_type'  => ['required', 'string', 'in:in_person,video_chat'],
            'date'       => ['required', 'date', 'after_or_equal:today'],
            'time'       => ['required', 'string', 'max:20'],
            'name'       => ['required', 'string', 'max:120'],
            'phone'      => ['nullable', 'string', 'max:30'],
            'email'      => ['required', 'email', 'max:180'],
            'message'    => ['nullable', 'string', 'max:2000'],
            'terms'      => ['accepted'],
        ]);

        $tourLabel = $data['tour_type'] === 'video_chat' ? 'Video chat tour' : 'In-person tour';
        $prettyDate = Carbon::parse($data['date'])->format('D, d M Y');

        // Combine date + time into a viewing slot the agent pipeline can show.
        $viewingAt = null;
        try {
            $viewingAt = Carbon::parse($data['date'].' '.$data['time']);
        } catch (\Throwable $e) {
            $viewingAt = Carbon::parse($data['date']);
        }

        // Fold the structured tour details into the message so they appear in
        // both the dashboard notification and the agent's email.
        $lines = [
            "🗓 Tour request: {$tourLabel}",
            "Requested slot: {$prettyDate} at {$data['time']}",
        ];
        if (! empty($data['message'])) {
            $lines[] = '';
            $lines[] = $data['message'];
        }

        $service->createTourRequest([
            'listing_id'           => $data['listing_id'],
            'name'                 => $data['name'],
            'email'                => $data['email'],
            'phone'                => $data['phone'] ?? null,
            'message'              => implode("\n", $lines),
            'user_id'              => $request->user()?->id,
            'viewing_scheduled_at' => $viewingAt,
        ]);

        $listing = Listing::find($data['listing_id']);

        return redirect()
            ->route('properties.show', $listing->slug)
            ->with('success', 'Your tour request has been sent — the agent will confirm your slot shortly.');
    }
}
