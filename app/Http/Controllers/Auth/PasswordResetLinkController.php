<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Inertia\Inertia;
use Inertia\Response;

class PasswordResetLinkController extends Controller
{
    /** Show the "forgot password" form. */
    public function create(): Response
    {
        return Inertia::render('Auth/ForgotPassword');
    }

    /** Email a password reset link. */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'email' => ['required', 'email'],
        ]);

        // Fire the broker (sends the ResetPassword notification on success), but
        // always respond generically so we never reveal whether an email is
        // registered (prevents user enumeration).
        Password::sendResetLink($request->only('email'));

        return back()->with(
            'success',
            'If that email is registered, a password reset link is on its way. Check your inbox — and your spam folder.'
        );
    }
}
