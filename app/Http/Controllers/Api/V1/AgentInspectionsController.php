<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Agent\InspectionsController;
use App\Http\Controllers\Api\V1\Concerns\RendersInertiaJson;
use App\Http\Controllers\Controller;
use App\Models\Inspection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Mobile API for the agent Inspections tab. List, form options, detail and
 * create delegate to the web InspectionsController.
 *
 * Photos are the one difference from the website: the web form posts every
 * room photo in a single request, which is fragile on mobile data and can
 * exceed PHP's upload limits. The app creates the inspection first, then
 * sends each photo on its own through addPhoto().
 */
class AgentInspectionsController extends Controller
{
    use RendersInertiaJson;

    /** Photos can be added while the agent is still on site finishing the inspection. */
    private const PHOTO_WINDOW_HOURS = 6;

    private const MAX_PHOTOS_PER_ROOM = 10;

    public function index(Request $request, InspectionsController $web): JsonResponse
    {
        return $this->inertiaJson($request, $web->index($request));
    }

    /** GET /agent/inspections/form?type=move_in|move_out — leases still needing that inspection. */
    public function form(Request $request, InspectionsController $web): JsonResponse
    {
        return $this->inertiaJson($request, $web->create($request));
    }

    public function show(Request $request, Inspection $inspection, InspectionsController $web): JsonResponse
    {
        return $this->inertiaJson($request, $web->show($request, $inspection));
    }

    /** POST /agent/inspections — rooms with condition + notes; photos follow via addPhoto(). */
    public function store(Request $request, InspectionsController $web): JsonResponse
    {
        $message = $this->webWrite(fn () => $web->store($request), 'Inspection added.');

        $id = Inspection::where('lease_id', $request->integer('lease_id'))
            ->where('type', $request->input('type'))
            ->where('conducted_by', $request->user()->id)
            ->value('id');

        return response()->json(['message' => $message, 'id' => $id], 201);
    }

    /** POST /agent/inspections/{inspection}/rooms/{room}/photos — one photo for one room. */
    public function addPhoto(Request $request, Inspection $inspection, int $room): JsonResponse
    {
        abort_unless((int) $inspection->conducted_by === (int) $request->user()->id, 403, 'You can only add photos to your own inspections.');
        abort_if(
            $inspection->created_at->lt(now()->subHours(self::PHOTO_WINDOW_HOURS)),
            422,
            'This inspection is closed. Photos can only be added while it is being completed.'
        );

        $request->validate(['photo' => ['required', 'image', 'max:8192']]);

        $rooms = is_array($inspection->rooms) ? $inspection->rooms : [];
        abort_unless(isset($rooms[$room]), 404, 'That room is not on this inspection.');

        $photos = $rooms[$room]['photos'] ?? [];
        abort_if(count($photos) >= self::MAX_PHOTOS_PER_ROOM, 422, 'A room can have up to ' . self::MAX_PHOTOS_PER_ROOM . ' photos.');

        $photos[] = Storage::url($request->file('photo')->store("inspections/{$inspection->id}", 'public'));
        $rooms[$room]['photos'] = $photos;
        $inspection->update(['rooms' => $rooms]);

        return response()->json(['message' => 'Photo added.', 'photos' => $photos], 201);
    }
}
