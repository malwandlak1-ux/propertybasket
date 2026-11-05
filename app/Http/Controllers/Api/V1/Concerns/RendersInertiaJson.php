<?php

namespace App\Http\Controllers\Api\V1\Concerns;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Response as InertiaResponse;

/**
 * Reuses the existing web controllers as the single source of truth for the
 * mobile API. An Inertia page response serialises itself to JSON whenever the
 * X-Inertia request header is present (see Inertia\Response::toResponse), so
 * we set that header and return the resolved page props verbatim.
 *
 * This keeps every dashboard number the mobile app shows byte-identical to
 * what the website shows — one payload builder, two clients.
 */
trait RendersInertiaJson
{
    protected function inertiaJson(Request $request, InertiaResponse $page): JsonResponse
    {
        $request->headers->set('X-Inertia', 'true');

        /** @var JsonResponse $response */
        $response = $page->toResponse($request);
        $data = $response->getData(true);

        return response()->json([
            'component' => $data['component'] ?? null,
            'data'      => $data['props'] ?? [],
        ]);
    }
}
