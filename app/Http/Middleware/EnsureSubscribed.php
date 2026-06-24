<?php

namespace App\Http\Middleware;

use App\Support\Billing;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Blocks agency / landlord users from their dashboard until they hold an active
 * subscription — either paid for, or unlocked with a valid promo code. A user
 * who has registered but not yet paid (or whose access has lapsed) is bounced
 * to the plan-selection / renewal page.
 *
 * Contractors, agents, tenants and admins are never gated here.
 */
class EnsureSubscribed
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user || ! Billing::requiresSubscription($user)) {
            return $next($request);
        }

        $owner = Billing::ownerFor($user);

        // No owner record yet, or an active subscription → let them through.
        if (! $owner || $owner->hasActiveSubscription()) {
            return $next($request);
        }

        $message = $owner->subscriptionExpired()
            ? 'Your subscription has expired. Renew to regain access to your dashboard.'
            : 'Choose a plan to activate your account before continuing.';

        return redirect()->route('billing.select')->with('error', $message);
    }
}
