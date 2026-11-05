<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * POST /api/v1/auth/login — exchange credentials for a bearer token.
     */
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email'       => ['required', 'email'],
            'password'    => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:120'],
        ]);

        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => 'Those credentials do not match our records.',
            ]);
        }

        if ($user->status !== UserStatus::Active) {
            throw ValidationException::withMessages([
                'email' => 'Your account is not active. Contact your agency or support.',
            ]);
        }

        $plainToken = $user->createToken($data['device_name'] ?? 'mobile')->plainTextToken;

        $user->forceFill(['last_active_at' => now()])->save();

        return response()->json([
            'token' => $plainToken,
            'user'  => $this->userPayload($user),
        ], 201);
    }

    /**
     * POST /api/v1/auth/logout — revoke the token used for this request.
     */
    public function logout(Request $request): JsonResponse
    {
        // Revoke only the token that authenticated this request, leaving the
        // user's other devices signed in.
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Signed out.']);
    }

    /**
     * GET /api/v1/me — current user + roles (mirrors Inertia auth.user prop).
     */
    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => $this->userPayload($request->user())]);
    }

    private function userPayload(User $user): array
    {
        return [
            'id'       => $user->id,
            'name'     => $user->name,
            'email'    => $user->email,
            'phone'    => $user->phone,
            'roles'    => $user->getRoleNames()->values(),
            'initials' => collect(explode(' ', $user->name))
                ->take(2)->map(fn ($w) => mb_substr($w, 0, 1))->implode(''),
        ];
    }
}
