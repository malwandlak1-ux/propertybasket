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
use App\Services\PdfService;
use App\Support\PlatformPlans;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Routing\Controller;
use Inertia\Inertia;
use Inertia\Response;

class OverviewController extends Controller
{
    use EnsuresSuperAdmin;

    public function index(Request $request): Response
    {
        $this->ensureSuperAdmin($request);

        $data = $this->collectOverview();

        return Inertia::render('Admin/Overview', [
            'counts'         => $this->sidebarCounts(),
            'kpis'           => $data['kpis'],
            'recent_signups' => $data['recent_signups'],
            'growth'         => $data['growth'],
            'health'         => $data['health'],
        ]);
    }

    /**
     * GET /admin/overview.pdf — same data as index(), rendered as a downloadable PDF.
     */
    public function exportPdf(Request $request, PdfService $pdf): HttpResponse
    {
        $this->ensureSuperAdmin($request);

        $data = $this->collectOverview();
        $generatedBy = $request->user()?->name ?? 'Super Admin';

        return $pdf->adminOverviewReport(
            kpis: $data['kpis'],
            recentSignups: $data['recent_signups'],
            growth: $data['growth'],
            health: $data['health'],
            generatedBy: $generatedBy,
            download: ! $request->boolean('preview'),
        );
    }

    /**
     * Single source of truth for the overview snapshot data so the screen
     * view and the PDF export never drift out of sync.
     */
    private function collectOverview(): array
    {
        $now       = CarbonImmutable::now();
        $yearStart = $now->startOfYear();

        // Account counts
        $agencyCount     = Agency::count();
        $landlordCount   = Landlord::count();
        $contractorCount = Contractor::count();
        $agencyAccounts  = $agencyCount + $landlordCount + $contractorCount;

        // End users
        $agentCount  = User::where('role', Role::Agent)->count();
        $tenantCount = User::where('role', Role::Tenant)->count();
        $endUsers    = $agentCount + $tenantCount;

        // GMV YTD = rent + commissions
        $gmvYtd = RentPayment::whereNotNull('paid_at')
            ->where('paid_at', '>=', $yearStart)
            ->sum('amount');

        $commissionYtd = Commission::where('status', 'paid')
            ->where('paid_at', '>=', $yearStart)
            ->sum('gross_commission');

        $gmvTotal = (float) $gmvYtd + (float) $commissionYtd;

        // MRR
        $agencies = Agency::where('status', 'active')->get();
        $mrr = 0;
        foreach ($agencies as $a) {
            $plan = $a->subscription_plan ?: PlatformPlans::STARTER;
            $mrr += PlatformPlans::priceFor($plan);
        }
        $mrr += LandlordModel::count() * PlatformPlans::priceFor(PlatformPlans::LANDLORD_PRIVATE);

        // New signups this month
        $newThisMonth = User::where('created_at', '>=', $now->startOfMonth())->count();

        // Recent signups
        $recentSignups = User::orderByDesc('created_at')
            ->limit(8)
            ->get(['id', 'name', 'email', 'role', 'created_at'])
            ->map(fn ($u) => [
                'id'         => $u->id,
                'name'       => $u->name,
                'email'      => $u->email,
                'role'       => $u->role?->value ?? 'unknown',
                'role_label' => $u->role?->label() ?? '—',
                'created_at' => $u->created_at?->diffForHumans(),
                'initials'   => collect(explode(' ', $u->name))->map(fn ($s) => $s[0])->slice(0, 2)->implode(''),
            ])
            ->all();

        // 6-month growth
        $growth = [];
        for ($i = 5; $i >= 0; $i--) {
            $mo   = $now->subMonths($i)->startOfMonth();
            $next = $mo->addMonth();
            $growth[] = [
                'label'       => $mo->format('M'),
                'agencies'    => User::where('role', Role::AgencyAdmin)->whereBetween('created_at', [$mo, $next])->count(),
                'landlords'   => User::where('role', Role::Landlord)->whereBetween('created_at', [$mo, $next])->count(),
                'contractors' => User::where('role', Role::Contractor)->whereBetween('created_at', [$mo, $next])->count(),
            ];
        }

        // System health (stubbed)
        $health = [
            ['name' => 'API',         'status' => 'healthy', 'detail' => '99.98% uptime'],
            ['name' => 'Paystack',    'status' => 'healthy', 'detail' => 'Webhooks healthy'],
            ['name' => 'Database',    'status' => 'healthy', 'detail' => '12ms latency'],
            ['name' => 'Email queue', 'status' => 'warning', 'detail' => '142 pending'],
        ];

        $listingCount = Listing::count();

        return [
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
        ];
    }
}
