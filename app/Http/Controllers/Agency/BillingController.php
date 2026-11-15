<?php

namespace App\Http\Controllers\Agency;

use App\Http\Controllers\Agency\Concerns\ResolvesAgency;
use App\Http\Controllers\Controller;
use App\Support\PlatformPlans;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class BillingController extends Controller
{
    use ResolvesAgency;

    public function show(Request $request): Response
    {
        $agency = $this->resolveAgency($request);

        // Only show agency-audience plans to agencies
        $plans = collect(PlatformPlans::all())
            ->filter(fn ($p) => $p['audience'] === 'agency')
            ->map(fn ($p) => $p + [
                'yearly_total'   => PlatformPlans::yearlyTotal((int) $p['price']),
                'yearly_monthly' => PlatformPlans::yearlyMonthly((int) $p['price']),
            ])
            ->values()
            ->all();

        // Billed yearly if the last paid subscription for this plan was a yearly one.
        $lastPaid = \App\Models\PlatformTransaction::where('subscriber_type', $agency->getMorphClass())
            ->where('subscriber_id', $agency->id)->where('type', 'subscription')->where('status', 'paid')
            ->latest('id')->value('description');
        $period = $lastPaid && str_ends_with($lastPaid, ':yearly') && str_starts_with($lastPaid, (string) $agency->subscription_plan . ':')
            ? 'yearly' : 'monthly';

        $currentKey = $agency->subscription_plan;
        $current    = $currentKey ? (PlatformPlans::all()[$currentKey] ?? null) : null;

        return Inertia::render('Agency/Billing', [
            'agency' => [
                'id'   => $agency->id,
                'name' => $agency->name,
            ],
            'current' => $current ? [
                'key'        => $current['key'],
                'name'       => $current['name'],
                'price'      => $current['price'],
                'headline'   => $current['headline'],
                'features'   => $current['features'],
                'expires_at' => $agency->subscription_expires_at?->format('d M Y'),
                'period'     => $period,
            ] : null,
            'plans' => $plans,
            'yearly_discount' => PlatformPlans::YEARLY_DISCOUNT_PERCENT,
            'payment_methods' => array_values(config('services.paystack.subscription_channels', ['card'])),
        ]);
    }

    /**
     * POST /agency/billing/switch — selects a new plan. In stub mode this just
     * writes the agency's subscription_plan; a live Paystack subscription flow
     * would replace this with a hosted-checkout redirect.
     */
    public function switch(Request $request): RedirectResponse
    {
        $agency = $this->resolveAgency($request);

        $agencyPlans = collect(PlatformPlans::all())
            ->filter(fn ($p) => $p['audience'] === 'agency')
            ->keys()
            ->all();

        $data = $request->validate([
            'plan_key' => ['required', Rule::in($agencyPlans)],
        ]);

        $agency->update([
            'subscription_plan'       => $data['plan_key'],
            'subscription_expires_at' => now()->addMonth(),
        ]);

        $name = PlatformPlans::all()[$data['plan_key']]['name'] ?? $data['plan_key'];

        return redirect()
            ->route('agency.billing.show')
            ->with('success', "You're now on the {$name} plan.");
    }
}
