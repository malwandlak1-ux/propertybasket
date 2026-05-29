<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\EnsuresSuperAdmin;
use App\Models\Contractor;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Inertia\Inertia;
use Inertia\Response;

class ContractorsController extends Controller
{
    use EnsuresSuperAdmin;

    public function index(Request $request): Response
    {
        $this->ensureSuperAdmin($request);

        $contractors = Contractor::with('user')
            ->orderByDesc('average_rating')
            ->get()
            ->map(function ($c) {
                $name = $c->user?->name ?? $c->business_name ?? '—';

                $docs = [
                    'cipc'      => $c->cipc_verified_at !== null,
                    'tax'       => $c->tax_clearance_verified_at !== null,
                    'insurance' => $c->insurance_verified_at !== null,
                ];
                $allVerified = $docs['cipc'] && $docs['tax'] && $docs['insurance'];
                $anyMissing  = ! $docs['cipc'] || ! $docs['tax'] || ! $docs['insurance'];

                $docStatus = match (true) {
                    $allVerified  => 'all_verified',
                    ! $docs['tax']       => 'tax_pending',
                    ! $docs['insurance'] => 'insurance_pending',
                    ! $docs['cipc']      => 'cipc_pending',
                    default              => 'pending',
                };

                return [
                    'id'             => $c->id,
                    'user_id'        => $c->user_id,
                    'name'           => $name,
                    'business_name'  => $c->business_name,
                    'email'          => $c->user?->email ?? '—',
                    'specialities'   => $c->specialities ?? [],
                    'service_areas'  => $c->service_areas ?? [],
                    'average_rating' => (float) ($c->average_rating ?? 0),
                    'total_reviews'  => $c->total_reviews ?? 0,
                    'total_jobs'     => $c->total_jobs ?? 0,
                    'docs'           => $docs,
                    'doc_status'     => $docStatus,
                    'status'         => $c->status ?? 'active',
                    'joined'         => $c->created_at?->format('M Y'),
                    'initials'       => collect(explode(' ', $name))->map(fn($s) => $s[0])->slice(0, 2)->implode(''),
                ];
            });

        $stats = [
            'total'      => $contractors->count(),
            'verified'   => $contractors->where('doc_status', 'all_verified')->count(),
            'pending'    => $contractors->whereIn('doc_status', ['tax_pending', 'insurance_pending', 'cipc_pending', 'pending'])->count(),
            'total_jobs' => $contractors->sum('total_jobs'),
        ];

        return Inertia::render('Admin/Contractors', [
            'counts'      => $this->sidebarCounts(),
            'contractors' => $contractors->values(),
            'stats'       => $stats,
        ]);
    }
}
