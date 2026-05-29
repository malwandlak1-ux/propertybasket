<?php

namespace App\Http\Controllers\Auth;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Models\Invitation;
use App\Models\User;
use App\Notifications\WelcomeUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

class InvitationController extends Controller
{
    public function show(string $token): Response
    {
        $invitation = $this->resolveInvitation($token);

        return Inertia::render('Auth/AcceptInvite', [
            'invitation' => [
                'token' => $invitation->token,
                'email' => $invitation->email,
                'role' => $invitation->role,
                'invited_by' => $invitation->invitedBy?->only(['name']),
            ],
        ]);
    }

    public function accept(Request $request, string $token): RedirectResponse
    {
        $invitation = $this->resolveInvitation($token);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'terms_accepted' => ['accepted'],
        ]);

        $user = DB::transaction(function () use ($invitation, $data) {
            // A tenant invite from an agent pre-creates the pending User (so
            // the lease has someone to point at). In every other flow no User
            // exists yet — handle both.
            $existing = User::where('email', $invitation->email)->first();

            if ($existing) {
                $existing->update([
                    'name'               => $data['name'],
                    'password'           => Hash::make($data['password']),
                    'status'             => UserStatus::Active,
                    'invited_by'         => $invitation->invited_by,
                    'invite_token'       => $invitation->token,
                    'invite_accepted_at' => now(),
                    'email_verified_at'  => now(),
                ]);
                if (! $existing->hasRole($invitation->role)) {
                    $existing->assignRole($invitation->role);
                }
                $user = $existing;
            } else {
                $user = User::create([
                    'name'               => $data['name'],
                    'email'              => $invitation->email,
                    'password'           => Hash::make($data['password']),
                    'role'               => Role::from($invitation->role),
                    'status'             => UserStatus::Active,
                    'invited_by'         => $invitation->invited_by,
                    'invite_token'       => $invitation->token,
                    'invite_accepted_at' => now(),
                    'email_verified_at'  => now(),
                ]);
                $user->assignRole($invitation->role);
            }

            $invitation->update(['accepted_at' => now()]);

            return $user;
        });

        Auth::login($user);
        $request->session()->regenerate();

        $user->notify(new WelcomeUser($user));

        return redirect()->route('dashboard');
    }

    private function resolveInvitation(string $token): Invitation
    {
        $invitation = Invitation::with('invitedBy')->where('token', $token)->first();

        if (! $invitation) {
            throw new HttpException(404, 'Invitation not found.');
        }

        if ($invitation->isAccepted()) {
            throw new HttpException(410, 'This invitation has already been used.');
        }

        if ($invitation->isExpired()) {
            throw new HttpException(410, 'This invitation has expired.');
        }

        return $invitation;
    }
}
