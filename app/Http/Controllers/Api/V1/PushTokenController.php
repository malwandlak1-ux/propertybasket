<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PushToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The mobile app registers its Expo push token after sign-in and removes it
 * on sign-out. A device has one token; if someone else signs in on the same
 * phone, the token moves to them.
 */
class PushTokenController extends Controller
{
    private const TOKEN_RULE = ['required', 'string', 'max:255', 'regex:/^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/'];

    /** POST /api/v1/push-tokens {token, platform} */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token'    => self::TOKEN_RULE,
            'platform' => ['nullable', 'string', 'in:android,ios,web'],
        ]);

        PushToken::updateOrCreate(
            ['token' => $data['token']],
            ['user_id' => $request->user()->id, 'platform' => $data['platform'] ?? null],
        );

        return response()->json(['message' => 'Push notifications on.'], 201);
    }

    /** DELETE /api/v1/push-tokens {token} — only the caller's own token. */
    public function destroy(Request $request): JsonResponse
    {
        $data = $request->validate(['token' => self::TOKEN_RULE]);

        PushToken::where('token', $data['token'])
            ->where('user_id', $request->user()->id)
            ->delete();

        return response()->json(['message' => 'Push notifications off.']);
    }
}
