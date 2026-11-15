<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Agent\ListingsController;
use App\Http\Controllers\Api\V1\Concerns\RendersInertiaJson;
use App\Http\Controllers\Controller;
use App\Models\Lease;
use App\Models\Listing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Mobile API for the agent Listings tab. Delegates to the web
 * ListingsController (same validation, ownership checks and photo storage).
 * Create / update take multipart form data so the app can send camera photos.
 */
class AgentListingsController extends Controller
{
    use RendersInertiaJson;

    /** GET /agent/listings?type=all|sale|rent|stay */
    public function index(Request $request, ListingsController $web): JsonResponse
    {
        return $this->inertiaJson($request, $web->index($request));
    }

    /** GET /agent/listings/form — options for a new listing (amenities, property types, provinces). */
    public function form(Request $request, ListingsController $web): JsonResponse
    {
        return $this->inertiaJson($request, $web->create($request));
    }

    /** GET /agent/listings/{listing} — the listing's editable fields plus the form options. */
    public function show(Request $request, Listing $listing, ListingsController $web): JsonResponse
    {
        return $this->inertiaJson($request, $web->edit($request, $listing));
    }

    public function store(Request $request, ListingsController $web): JsonResponse
    {
        $web->store($request);

        return response()->json(['message' => 'Listing created.'], 201);
    }

    public function update(Request $request, Listing $listing, ListingsController $web): JsonResponse
    {
        $web->update($request, $listing);

        return response()->json(['message' => 'Listing updated.']);
    }

    public function destroy(Request $request, Listing $listing, ListingsController $web): JsonResponse
    {
        // The web action reports these two refusals as a flash + redirect.
        abort_if(
            (int) $listing->agent_id === (int) $request->user()->id
                && ($listing->status === 'leased'
                    || Lease::where('listing_id', $listing->id)->whereIn('status', ['active', 'pending'])->exists()),
            422,
            'This listing has a current lease. Reactivate it to end the lease before deleting it.'
        );
        abort_if(
            (int) $listing->agent_id === (int) $request->user()->id && $listing->status === 'sold',
            422,
            'Sold listings are kept for your commission records and can’t be deleted.'
        );

        $web->destroy($request, $listing);

        return response()->json(['message' => 'Listing deleted.']);
    }

    public function reactivate(Request $request, Listing $listing, ListingsController $web): JsonResponse
    {
        $web->reactivate($request, $listing);

        return response()->json(['message' => 'Listing is live again.']);
    }

    public function markSold(Request $request, Listing $listing, ListingsController $web): JsonResponse
    {
        $web->markSold($request, $listing);

        return response()->json(['message' => 'Sale recorded. Your commission is in the agency payout queue.']);
    }

    public function markLeased(Request $request, Listing $listing, ListingsController $web): JsonResponse
    {
        $web->markLeased($request, $listing);

        return response()->json(['message' => 'Marked as rented.']);
    }
}
