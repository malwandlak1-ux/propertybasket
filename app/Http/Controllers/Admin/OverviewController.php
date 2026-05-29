<?php

namespace App\Http\Controllers\Admin;

use App\Enums\Role;
use App\Http\Controllers\Admin\Concerns\EnsuresSuperAdmin;
use App\Models\Agency;
use App\Models\Commission;
use App\Models\Contractor;
use App\Models\Landlord;
use App\Models\Listing;
use App\Models\Landlord as LandlordModel;
use App\Models\RentPayment;
use App\Models\User;
use App\Support\PlatformPlans;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Inertia\Inertia;
use Inertia\Response;

class OverviewController extends Controller
{
    use EnsuresSuperAdmin;

    public function index(Request $request): Response
    {
        $this->ensureSuperAdmin($request);

        $now       = CarbonImmutable::now();
        $yearStart = $now->startOfYear();

        // ── Account counts ────────────────────────────────────────────────
        $agencyCount    = Agency::count();
        $landlordCount  = Landlord::count();
        $contractorCount= Contractor::count();
        $agencyAccounts = $agencyCount + $landlordCount + $contractorCount;

        // End users = agents + tenants
        $agentCount  = User::where('role', Role::Agent)->count();
        $tenantCount = User::where('role', Role::Tenant)->count();
        $endUsers    = $agentCount + $tenantCount;

        // ── GMV (gross merchandise value — rent collected YTD) ────────────
        $gmvYtd = RentPayment::whereNotNull('paid_at')
            ->where('paid_at', '>=', $yearStart)
            ->sum('amount');

        // Plus commission payouts YTD
        $commissionYtd = Commission::where('status', 'paid')
            ->where('paid_at', '>=', $yearStart)
            ->sum('gross_commission');

        $gmvTotal = (float) $gmvYtd + (float) $commissionYtd;

        // ── MRR estimate (active agency subs + landlord subs × tier price) ─
        $agencies = Agency::where('status', 'active')->get();
        $mrr = 0;
        foreach ($agencies as $a) {
            $plan = $a->subscription_plan ?: PlatformPlans::STARTER;
            $mrr += PlatformPlans::priceFor($plan);
        }
        // Landlord subscriptions
        $mrr += LandlordModel::count() * PlatformPlans::priceFor(PlatformPlans::LANDLORD_PRIVATE);

        // ── New signups this month (by role) ──────────────────────────────
        $startOfMonth = $now->startOfMonth();
        $newThisMonth = User::where('created_at', '>=', $startOfMonth)->count();

        // ── Recent signups (last 8 across all roles) ──────────────────────
        $recentSignups = User::orderByDesc('created_at')
            ->limit(8)
            ->get(['id', 'name', 'email', 'role', 'created_at'])
            ->map(function ($u) {
                return [
                    'id'         => $u->id,
                    'name'       => $u->name,
                    'email'      => $u->email,
                    'role'       => $u->role?->value ?? 'unknown',
                    'role_label' => $u->role?->label() ?? '—',
                    'created_at' => $u->created_at?->diffForHumans(),
                    'initials'   => collect(explode(' ', $u->name))->map(fn($s) => $s[0])->slice(0, 2)->implode(''),
                ];
            });

        // ── 6-month signup growth chart ───────────────────────────────────
        $growth = [];
        for ($i = 5; $i >= 0; $i--) {
            $mo    = $now->subMonths($i)->startOfMonth();
            $next  = $mo->addMonth();
            $label = $mo->format('M');

            $growth[] = [
                'label'      => $label,
                'agencies'   => User::where('role', Role::AgencyAdmin)->whereBetween('created_at', [$mo, $next])->count(),
                'landlords'  => User::where('role', Role::Landlord)->whereBetween('created_at', [$mo, $next])->count(),
                'contractors'=> User::where('role', Role::Contractor)->whereBetween('created_at', [$mo, $next])->count(),
            ];
        }

        // ── System health (stub — these would come from real monitoring) ──
        $health = [
            ['name' => 'API',        'status' => 'healthy', 'detail' => '99.98% uptime'],
            ['name' => 'Paystack',   'status' => 'healthy', 'detail' => 'Webhooks healthy'],
            ['name' => 'Database',   'status' => 'healthy', 'detail' => '12ms latency'],
            ['name' => 'Email queue','status' => 'warning', 'detail' => '142 pending'],
        ];

        // ── Listings count ────────────────────────────────────────────────
        $listingCount = Listing::count();

        return Inertia::render('Admin/Overview', [
            'counts' => $this->sidebarCounts(),
            'kpis' => [
                'mrr'             => $mrr,
                'agency_accounts' => $agencyAccounts,
                'agencies'        => $agencyCount,
                'landlords'       => $landlordCount,
                'contractors'     => $contractorCount,
                'end_users'       => $endUsers,
                'agents'          => $agentCount,
                'tenants'         => $tenantCount,
                'listings'        => $listingCount,
                'gmv_ytd'         => $gmvTotal,
                'new_this_month'  => $newThisMonth,
            ],
            'recent_signups' => $recentSignups,
            'growth'         => $growth,
            'health'         => $health,
        ]);
    }
}
