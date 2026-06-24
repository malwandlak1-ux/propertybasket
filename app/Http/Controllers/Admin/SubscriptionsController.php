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
     *
     * Self-healing: if no row exists for $key yet but the key is a known plan
     * in PlatformPlans::defaults(), we hydrate a row from defaults first then
     * apply the update. Stops fresh DBs (where PlatformPlansSeeder was never
     * run) from 404-ing on the very first edit.
     */
    public function update(Request $request, string $key): RedirectResponse
    {
        $this->ensureSuperAdmin($request);

        $data = $request->validate([
            'name'       => ['required', 'string', 'max:120'],
            'price'      => ['required', 'integer', 'min:0', 'max:999999'],
            'headline'   => ['required', 'string', 'max:160'],
            'features'   => ['nullable', 'array', 'max:10'],
            'features.*' => ['string', 'max:120'],
            'is_popular' => ['required', 'boolean'],
        ]);

        $plan = PlatformPlan::where('key', $key)->first();

        if (! $plan) {
            $defaults = PlatformPlans::defaults();
            if (! isset($defaults[$key])) {
                abort(404, "Unknown plan key '{$key}'.");
            }
            $seed = $defaults[$key];

            $plan = PlatformPlan::create(array_merge($data, [
                'key'        => $key,
                'audience'   => $seed['audience'],
                'sort_order' => 0,
                'is_active'  => true,
            ]));
        } else {
            $plan->update($data);
        }

        return back()->with('success', "Plan \"{$plan->name}\" updated.");
    }
}
