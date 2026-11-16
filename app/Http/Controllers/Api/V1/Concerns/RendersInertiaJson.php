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

    /**
     * Runs a web controller write and returns its success message.
     *
     * Web actions refuse some writes with `back()->with('error', …)`: a
     * redirect the app can't read. The flash lands in the session store even
     * though API requests carry no session, so we pull it and answer 422 JSON
     * with the same wording the website shows.
     */
    protected function webWrite(callable $action, string $fallback = 'Saved.'): string
    {
        $session = app('session.store');
        $session->forget(['error', 'success']);

        $action();

        if ($error = $session->pull('error')) {
            abort(422, (string) $error);
        }

        return (string) ($session->pull('success') ?: $fallback);
    }
}
