<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\EnsuresSuperAdmin;
use App\Models\Agency;
use Illuminate\Http\RedirectResponse;
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
                    'trust'           => [
                        'status'          => $a->trust_verified_at ? 'verified' : (filled($a->trust_account_number) ? 'review' : 'none'),
                        'bank'            => $a->trust_bank,
                        'holder'          => $a->trust_account_holder,
                        'account_number'  => $a->trust_account_number,
                        'branch_code'     => $a->trust_branch_code,
                        'account_type'    => $a->trust_account_type,
                        'auditor'         => $a->trust_auditor_name,
                        'auditor_number'  => $a->trust_auditor_practice_number,
                        'verified_at'     => $a->trust_verified_at?->format('d M Y H:i'),
                        'updated_at'      => $a->updated_at?->format('d M Y H:i'),
                    ],
                    'status'          => $a->status ?? 'active',
                    'initials'        => collect(explode(' ', $a->name))->map(fn($s) => $s[0])->slice(0, 2)->implode(''),
                ];
            });

        $stats = [
            'active'    => $agencies->where('status', 'active')->count(),
            'pending'   => $agencies->where('status', 'pending')->count(),
            'suspended' => $agencies->where('status', 'suspended')->count(),
            'total_agents' => $agencies->sum('agents_count'),
            'trust_review' => $agencies->where('trust.status', 'review')->count(),
        ];

        return Inertia::render('Admin/Agencies', [
            'counts'   => $this->sidebarCounts(),
            'agencies' => $agencies->values(),
            'stats'    => $stats,
        ]);
    }

    public function approve(Request $request, Agency $agency): RedirectResponse
    {
        $this->ensureSuperAdmin($request);

        if ($agency->status !== 'pending') {
            return back()->with('error', "Only pending agencies can be approved (current status: {$agency->status}).");
        }

        $agency->update(['status' => 'active']);

        return back()->with('success', "{$agency->name} approved.");
    }

    public function suspend(Request $request, Agency $agency): RedirectResponse
    {
        $this->ensureSuperAdmin($request);

        if ($agency->status === 'suspended') {
            return back()->with('error', "{$agency->name} is already suspended.");
        }

        $agency->update(['status' => 'suspended']);

        return back()->with('success', "{$agency->name} suspended.");
    }

    public function reactivate(Request $request, Agency $agency): RedirectResponse
    {
        $this->ensureSuperAdmin($request);

        if ($agency->status === 'active') {
            return back()->with('error', "{$agency->name} is already active.");
        }

        $agency->update(['status' => 'active']);

        return back()->with('success', "{$agency->name} reactivated.");
    }

    /** POST /admin/agencies/{agency}/verify-trust — verify (or revoke) the agency's trust account. */
    public function verifyTrust(Request $request, Agency $agency): RedirectResponse
    {
        $this->ensureSuperAdmin($request);

        if ($agency->trust_verified_at !== null) {
            $agency->update(['trust_verified_at' => null]);

            return back()->with('success', "{$agency->name}: trust account verification revoked.");
        }

        $required = ['trust_bank', 'trust_account_holder', 'trust_account_number', 'trust_branch_code', 'trust_account_type', 'trust_auditor_name', 'trust_auditor_practice_number'];
        if (collect($required)->contains(fn ($f) => blank($agency->{$f}))) {
            return back()->with('error', "{$agency->name} hasn't captured all its trust account details yet.");
        }

        $agency->update(['trust_verified_at' => now()]);
        try {
            $agency->owner?->notify(new \App\Notifications\TrustAccountVerified($agency));
        } catch (\Throwable $e) {
            report($e);
        }

        return back()->with('success', "{$agency->name}: trust account verified.");
    }

    public function verifyEaab(Request $request, Agency $agency): RedirectResponse
    {
        $this->ensureSuperAdmin($request);

        if ($agency->eaab_verified_at !== null) {
            $agency->update(['eaab_verified_at' => null]);

            return back()->with('success', "{$agency->name}: EAAB verification revoked.");
        }

        if (empty($agency->eaab_ffc_number)) {
            return back()->with('error', "{$agency->name} has no FFC number on file — cannot mark verified.");
        }

        $agency->update(['eaab_verified_at' => now()]);

        return back()->with('success', "{$agency->name}: EAAB verified.");
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
