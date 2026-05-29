<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\EnsuresSuperAdmin;
use App\Models\Agency;
use App\Models\Landlord;
use App\Models\PlatformPlan;
use App\Support\PlatformPlans;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Inertia\Inertia;
use Inertia\Response;

class SubscriptionsController extends Controller
{
    use EnsuresSuperAdmin;

    public function index(Request $request): Response
    {
        $this->ensureSuperAdmin($request);

        $plans = PlatformPlans::all();

        $agencyCounts = Agency::selectRaw('subscription_plan, COUNT(*) as c')
            ->groupBy('subscription_plan')
            ->pluck('c', 'subscription_plan')
            ->toArray();
        $landlordCount = Landlord::count();

        $cards = [];
        foreach ($plans as $key => $plan) {
            $subs = match ($key) {
                PlatformPlans::LANDLORD_PRIVATE => $landlordCount,
                default                          => (int) ($agencyCounts[$key] ?? 0),
            };

            $cards[] = [
                'key'      => $plan['key'],
                'name'     => $plan['name'],
                'audience' => $plan['audience'],
                'price'    => $plan['price'],
                'headline' => $plan['headline'],
                'features' => $plan['features'],
                'popular'  => $plan['popular'] ?? false,
                'subs'     => $subs,
                'mrr'      => $subs * $plan['price'],
            ];
        }

        return Inertia::render('Admin/Subscriptions', [
            'counts'                  => $this->sidebarCounts(),
            'plans'                   => $cards,
            'contractor_fee_percent'  => PlatformPlans::CONTRACTOR_FEE_PERCENT,
        ]);
    }

    /**
     * PATCH /admin/subscriptions/{plan}/update — edit price, headline, features,
     * or "popular" flag. Agency Billing tabs reflect the change on next load.
     */
    public function update(Request $request, string $key): RedirectResponse
    {
        $this->ensureSuperAdmin($request);

        $plan = PlatformPlan::where('key', $key)->firstOrFail();

        $data = $request->validate([
            'name'       => ['required', 'string', 'max:120'],
            'price'      => ['required', 'integer', 'min:0', 'max:999999'],
            'headline'   => ['required', 'string', 'max:160'],
            'features'   => ['nullable', 'array', 'max:10'],
            'features.*' => ['string', 'max:120'],
            'is_popular' => ['required', 'boolean'],
        ]);

        $plan->update($data);

        return back()->with('success', "Plan \"{$plan->name}\" updated.");
    }
}
