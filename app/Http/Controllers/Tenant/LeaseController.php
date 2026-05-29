<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Tenant\Concerns\ResolvesTenant;
use App\Models\Inspection;
use App\Services\PdfService;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LeaseController extends Controller
{
    use ResolvesTenant;

    public function index(Request $request): Response
    {
        $lease = $this->resolveLease($request);
        $user  = $request->user();
        $now   = CarbonImmutable::now();
        $start = CarbonImmutable::parse($lease->start_date);
        $end   = CarbonImmutable::parse($lease->end_date);

        // ── Documents (synthesised — real upload pipeline is a Phase 9 task) ─
        $documents = [
            [
                'id'         => 'lease',
                'title'      => 'Lease Agreement',
                'subtitle'   => 'Master lease · Signed',
                'meta'       => $lease->signed_at?->format('d M Y') ?? $start->format('d M Y'),
                'tone'       => 'rose',
                'icon'       => 'doc',
                'signed'     => true,
            ],
            [
                'id'         => 'house-rules',
                'title'      => 'House Rules',
                'subtitle'   => 'Body corporate conduct',
                'meta'       => $start->format('d M Y'),
                'tone'       => 'emerald',
                'icon'       => 'building',
                'signed'     => true,
            ],
            [
                'id'         => 'deposit-receipt',
                'title'      => 'Deposit Receipt',
                'subtitle'   => 'Section 32 trust',
                'meta'       => $start->format('d M Y'),
                'tone'       => 'brand',
                'icon'       => 'badge',
                'signed'     => true,
            ],
        ];

        // ── Key dates ─────────────────────────────────────────────────────────
        $moveIn = Inspection::where('lease_id', $lease->id)
            ->where('type', 'move_in')
            ->first();

        $renewalWindow = $end->subDays(60);

        $keyDates = [
            [
                'label'    => 'Move-in Inspection',
                'sub'      => $moveIn
                    ? ($moveIn->status === 'completed'
                        ? 'Completed ' . ($moveIn->agent_signed_at?->format('d M Y') ?? $start->format('d M Y'))
                        : 'In progress')
                    : 'Pending — agent will schedule',
                'tone'     => $moveIn && $moveIn->status === 'completed' ? 'success' : 'brand',
                'icon'     => 'check',
            ],
            [
                'label'    => 'Renewal Decision Window Opens',
                'sub'      => $renewalWindow->format('d M Y') . ' · 60 days before lease end',
                'tone'     => 'warning',
                'icon'     => 'clock',
            ],
            [
                'label'    => 'Lease End',
                'sub'      => $end->format('d M Y') . ' · Move-out inspection required',
                'tone'     => 'danger',
                'icon'     => 'door',
            ],
        ];

        return Inertia::render('Tenant/Lease', [
            'tenant' => [
                'id'   => $user->id,
                'name' => $user->name,
            ],
            'lease' => [
                'id'              => $lease->id,
                'address'         => $lease->listing?->address ?? $lease->listing?->title ?? '',
                'suburb'          => $lease->listing?->suburb,
                'city'            => $lease->listing?->city,
                'postal_code'     => $lease->listing?->postal_code ?? null,
                'property_type'   => $lease->listing?->property_type,
                'bedrooms'        => $lease->listing?->bedrooms,
                'monthly_rent'    => (float) $lease->monthly_rent,
                'deposit_amount'  => (float) $lease->deposit_amount,
                'start_date'      => $start->format('Y/m/d'),
                'end_date'        => $end->format('Y/m/d'),
                'notice_period_days'  => $lease->notice_period_days,
                'escalation_percent'  => (float) $lease->escalation_percent,
                'status'              => $lease->status,
            ],
            'documents' => $documents,
            'key_dates' => $keyDates,
        ]);
    }

    /**
     * Download / stream the lease agreement PDF.
     */
    public function agreement(Request $request, PdfService $pdf)
    {
        $lease = $this->resolveLease($request);
        return $pdf->leaseAgreement($lease, download: $request->boolean('download'));
    }
}
