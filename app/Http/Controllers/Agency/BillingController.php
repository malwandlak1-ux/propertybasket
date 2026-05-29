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
            ->values()
            ->all();

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
            ] : null,
            'plans' => $plans,
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
