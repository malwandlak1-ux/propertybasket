<?php

namespace App\Http\Controllers\Billing;

use App\Http\Controllers\Controller;
use App\Models\PromoCode;
use App\Models\PromoCodeRedemption;
use App\Services\PaystackService;
use App\Support\Billing;
use App\Support\PlatformPlans;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class SubscriptionController extends Controller
{
    public function __construct(private readonly PaystackService $paystack) {}

    /**
     * Plan-selection / renewal page shown to agencies & landlords that don't yet
     * have an active subscription (and reachable any time to renew).
     */
    public function select(Request $request): Response|RedirectResponse
    {
        $user     = $request->user();
        $audience = Billing::audienceFor($user);
        $owner    = Billing::ownerFor($user);

        // Anyone who doesn't pay (contractor/agent/tenant/admin) shouldn't be here.
        if (! $audience || ! $owner) {
            return redirect()->route('dashboard');
        }

        $plans = collect(PlatformPlans::all())
            ->filter(fn ($p) => $p['audience'] === $audience)
            ->map(fn ($p) => [
                'key'      => $p['key'],
                'name'     => $p['name'],
                'price'    => $p['price'],
                'headline' => $p['headline'],
                'features' => $p['features'] ?? [],
                'popular'  => $p['popular'] ?? false,
            ])
            ->values()
            ->all();

        return Inertia::render('Billing/SelectPlan', [
            'user'      => ['name' => $user->name, 'email' => $user->email],
            'audience'  => $audience,
            'plans'     => $plans,
            'subscription' => [
                'active'         => $owner->hasActiveSubscription(),
                'expired'        => $owner->subscriptionExpired(),
                'is_promo'       => $owner->isPromoSubscription(),
                'plan'           => $owner->subscription_plan,
                'expires_at'     => $owner->subscription_expires_at?->format('d M Y'),
                'days_remaining' => $owner->subscriptionDaysRemaining(),
            ],
        ]);
    }

    /**
     * Pay for a plan via Paystack. Redirects to the hosted checkout (or, in
     * stub mode, straight to the callback).
     */
    public function checkout(Request $request): RedirectResponse
    {
        $user     = $request->user();
        $audience = Billing::audienceFor($user);
        $owner    = Billing::ownerFor($user);

        if (! $audience || ! $owner) {
            return redirect()->route('dashboard');
        }

        $plans = collect(PlatformPlans::all())->filter(fn ($p) => $p['audience'] === $audience);

        $data = $request->validate([
            'plan_key' => ['required', 'string'],
        ]);

        $plan = $plans->get($data['plan_key']);
        if (! $plan) {
            return back()->with('error', 'That plan is not available for your account.');
        }

        // Remember the chosen plan so the callback can activate the right tier.
        $request->session()->put('billing.plan_key', $plan['key']);

        $init = $this->paystack->initializeSubscriptionPayment(
            $user, $owner, $plan['key'], (int) $plan['price']
        );

        return redirect()->away($init['authorization_url']);
    }

    /**
     * Apply a promo code: grants full free access for the code's duration.
     * One redemption per user — a code already used by this account is rejected,
     * even after its access window has lapsed.
     */
    public function applyPromo(Request $request): RedirectResponse
    {
        $user     = $request->user();
        $audience = Billing::audienceFor($user);
        $owner    = Billing::ownerFor($user);

        if (! $audience || ! $owner) {
            return redirect()->route('dashboard');
        }

        $data = $request->validate([
            'promo_code' => ['required', 'string', 'max:60'],
        ]);

        $code = PromoCode::whereRaw('UPPER(code) = ?', [strtoupper(trim($data['promo_code']))])->first();

        if (! $code) {
            return back()->with('error', 'That promo code was not recognised.');
        }
        if ($reason = $code->generalRejection()) {
            return back()->with('error', $reason);
        }
        if (! $code->appliesToAudience($audience)) {
            return back()->with('error', "This promo code isn't valid for {$audience} accounts.");
        }
        if (PromoCodeRedemption::where('promo_code_id', $code->id)->where('user_id', $user->id)->exists()) {
            return back()->with('error', 'You have already used this promo code on your account.');
        }

        $expiresAt = $code->accessExpiryFromNow();

        DB::transaction(function () use ($code, $user, $owner, $expiresAt) {
            PromoCodeRedemption::create([
                'promo_code_id'    => $code->id,
                'user_id'          => $user->id,
                'subscriber_type'  => $owner->getMorphClass(),
                'subscriber_id'    => $owner->getKey(),
                'access_expires_at'=> $expiresAt,
            ]);
            $code->increment('times_redeemed');
            $owner->activateSubscription($owner::PROMO_PLAN_KEY, $expiresAt);
        });

        return redirect()->route('dashboard')->with(
            'success',
            "Promo code applied — you have free access until {$expiresAt->format('d M Y')}."
        );
    }

    /**
     * Return point after Paystack checkout. Verifies the reference and, on
     * success, activates a one-month paid subscription on the right tier.
     */
    public function callback(Request $request): RedirectResponse
    {
        $reference = (string) $request->query('reference', '');
        if ($reference === '') {
            return redirect()->route('billing.select')->with('error', 'Missing payment reference.');
        }

        try {
            $txn = $this->paystack->verifySubscriptionPayment($reference);
        } catch (\Throwable $e) {
            report($e);
            return redirect()->route('billing.select')
                ->with('error', 'We could not verify your payment. If you were charged, contact support.');
        }

        if (! $txn) {
            return redirect()->route('billing.select')->with('error', 'Payment reference not recognised.');
        }
        if ($txn->status !== 'paid') {
            return redirect()->route('billing.select')->with('error', 'Your payment did not complete.');
        }

        $owner = $txn->subscriber; // Agency or Landlord
        if (! $owner) {
            return redirect()->route('billing.select')->with('error', 'Could not match the payment to your account.');
        }

        $planKey = $txn->description ?: $request->session()->pull('billing.plan_key');
        $owner->activateSubscription($planKey, now()->addMonth());
        $request->session()->forget('billing.plan_key');

        $planName = PlatformPlans::all()[$planKey]['name'] ?? 'subscription';

        return redirect()->route('dashboard')->with(
            'success',
            "Payment successful — your {$planName} plan is now active."
        );
    }
}
