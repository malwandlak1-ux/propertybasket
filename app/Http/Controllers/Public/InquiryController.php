<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\Listing;
use App\Services\InquiryService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class InquiryController extends Controller
{
    public function store(Request $request, InquiryService $service): RedirectResponse
    {
        $data = $request->validate([
            'listing_id' => ['required', 'integer', 'exists:listings,id'],
            'listing_unit_id' => ['nullable', 'integer', 'exists:listing_units,id'],
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:180'],
            'phone' => ['nullable', 'string', 'max:30'],
            'message' => ['nullable', 'string', 'max:2000'],
        ]);

        $data['user_id'] = $request->user()?->id;
        $data['source'] = 'website';

        $service->createFromWebsite($data);

        $listing = Listing::find($data['listing_id']);

        return redirect()
            ->route('properties.show', $listing->slug)
            ->with('success', 'Thanks! Your inquiry has been sent. The listing owner will reach out shortly.');
    }
}
