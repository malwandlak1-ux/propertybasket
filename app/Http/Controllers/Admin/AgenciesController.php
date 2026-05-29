<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\EnsuresSuperAdmin;
use App\Models\Agency;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Inertia\Inertia;
use Inertia\Response;

class AgenciesController extends Controller
{
    use EnsuresSuperAdmin;

    public function index(Request $request): Response
    {
        $this->ensureSuperAdmin($request);

        $agencies = Agency::with(['owner', 'agents'])
            ->withCount(['agents', 'listings'])
            ->orderBy('name')
            ->get()
            ->map(function ($a) {
                $plan = $a->subscription_plan ?? $this->inferPlan($a->agents_count);

                return [
                    'id'              => $a->id,
                    'name'            => $a->name,
                    'slug'            => $a->slug,
                    'city'            => $this->extractCity($a->head_office_address ?? ''),
                    'created_at'      => $a->created_at?->format('M Y'),
                    'plan'            => $plan,
                    'agents_count'    => $a->agents_count,
                    'listings_count'  => $a->listings_count,
                    'eaab_ffc_number' => $a->eaab_ffc_number,
                    'eaab_verified'   => $a->eaab_verified_at !== null,
                    'vat_registered'  => $a->vat_registered,
                    'status'          => $a->status ?? 'active',
                    'initials'        => collect(explode(' ', $a->name))->map(fn($s) => $s[0])->slice(0, 2)->implode(''),
                ];
            });

        $stats = [
            'active'    => $agencies->where('status', 'active')->count(),
            'pending'   => $agencies->where('status', 'pending')->count(),
            'suspended' => $agencies->where('status', 'suspended')->count(),
            'total_agents' => $agencies->sum('agents_count'),
        ];

        return Inertia::render('Admin/Agencies', [
            'counts'   => $this->sidebarCounts(),
            'agencies' => $agencies->values(),
            'stats'    => $stats,
        ]);
    }

    private function inferPlan(int $agentCount): string
    {
        return match (true) {
            $agentCount >= 15 => 'enterprise',
            $agentCount >= 5  => 'growth',
            default           => 'starter',
        };
    }

    private function extractCity(string $address): string
    {
        $parts = array_map('trim', explode(',', $address));
        return $parts[count($parts) - 2] ?? $parts[0] ?? '—';
    }
}
