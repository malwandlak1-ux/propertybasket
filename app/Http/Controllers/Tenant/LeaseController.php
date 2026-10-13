<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Tenant\Concerns\ResolvesTenant;
use App\Models\Inspection;
use App\Notifications\LeaseSigned;
use App\Services\PdfService;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
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

        $hasDeposit = (float) $lease->deposit_amount > 0;
        $managedBy  = $lease->agency?->name ?? $lease->landlord?->name;
        $scheduler  = $lease->agency_id ? 'your agent' : 'your landlord';

        // ── Documents ────────────────────────────────────────────────────────
        // Only the lease agreement has a real file (uploaded signed copy, else
        // the generated PDF). The others are listed as not yet available
        // rather than pretending to be signed.
        $documents = [
            [
                'id'         => 'lease',
                'title'      => 'Lease Agreement',
                'subtitle'   => $lease->document_path ? 'Signed copy uploaded by ' . ($managedBy ?? 'your landlord') : 'Master lease',
                'meta'       => $lease->tenant_signed_at || $lease->signed_at
                    ? 'Signed ' . ($lease->tenant_signed_at ?? $lease->signed_at)->format('d M Y')
                    : 'Awaiting signature',
                'tone'       => 'rose',
                'icon'       => 'doc',
                'signed'     => (bool) ($lease->tenant_signed_at || $lease->signed_at),
                'available'  => true,
            ],
            [
                'id'         => 'house-rules',
                'title'      => 'House Rules',
                'subtitle'   => 'Conduct and building rules',
                'meta'       => 'Not uploaded yet',
                'tone'       => 'emerald',
                'icon'       => 'building',
                'signed'     => false,
                'available'  => false,
            ],
        ];
        if ($hasDeposit) {
            $documents[] = [
                'id'         => 'deposit-receipt',
                'title'      => 'Deposit Receipt',
                'subtitle'   => 'Proof of deposit paid',
                'meta'       => 'Not uploaded yet',
                'tone'       => 'brand',
                'icon'       => 'badge',
                'signed'     => false,
                'available'  => false,
            ];
        }

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
                    : "Pending — {$scheduler} will schedule",
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
                'start_date'      => $start->format('d M Y'),
                'end_date'        => $end->format('d M Y'),
                'months_elapsed'  => max(0, (int) $start->diffInMonths(min($now, $end))),
                'months_total'    => max(1, (int) round($start->diffInMonths($end))),
                'managed_by'      => $managedBy,
                'is_agency'       => (bool) $lease->agency_id,
                'has_deposit'     => $hasDeposit,
                'has_upload'      => (bool) $lease->document_path,
                'notice_period_days'  => $lease->notice_period_days,
                'escalation_percent'  => (float) $lease->escalation_percent,
                'status'              => $lease->status,
            ],
            'documents' => $documents,
            'key_dates' => $keyDates,
        ]);
    }

    /**
     * Download / stream the lease agreement. A signed agreement uploaded by
     * the landlord wins; otherwise the generated PDF.
     */
    public function agreement(Request $request, PdfService $pdf)
    {
        $lease = $this->resolveLease($request);

        if ($lease->document_path && \Illuminate\Support\Facades\Storage::disk('local')->exists($lease->document_path)) {
            return \App\Http\Controllers\Landlord\TenantsController::streamAgreement($lease, $request->boolean('download'));
        }

        return $pdf->leaseAgreement($lease, download: $request->boolean('download'));
    }

    /**
     * POST /tenant/lease/sign — tenant signs the lease electronically by
     * typing their full name. One-shot: re-signing is rejected. Activates a
     * pending lease and notifies the agent (and landlord, if any).
     */
    public function sign(Request $request): RedirectResponse
    {
        $lease = $this->resolveLease($request);
        $user  = $request->user();

        abort_unless($lease->tenant_id === $user->id, 403, 'Only the lease tenant can sign.');

        if ($lease->tenant_signed_at) {
            return back()->with('error', 'This lease has already been signed.');
        }

        $data = $request->validate([
            'signature' => ['required', 'string', 'max:120'],
            'agreed'    => ['accepted'],
        ]);

        $lease->update([
            'tenant_signed_at' => now(),
            'tenant_signature' => $data['signature'],
            'signed_at'        => $lease->signed_at ?? now(),
            'status'           => $lease->status === 'pending' ? 'active' : $lease->status,
        ]);

        // Tell the agent (and landlord) the lease is signed.
        foreach ([$lease->agent, $lease->landlord] as $recipient) {
            if ($recipient) {
                try {
                    $recipient->notify(new LeaseSigned($lease));
                } catch (\Throwable $e) {
                    report($e);
                }
            }
        }

        return back()->with('success', 'Lease signed — a copy is available under Lease Documents.');
    }
}
