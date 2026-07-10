<?php

namespace App\Http\Controllers\Agency;

use App\Http\Controllers\Agency\Concerns\ResolvesAgency;
use App\Http\Controllers\Controller;
use App\Models\Lease;
use App\Services\LeaseBillingService;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TenantsController extends Controller
{
    use ResolvesAgency;

    public function index(Request $request): Response
    {
        $agency = $this->resolveAgency($request);
        $now    = CarbonImmutable::now();

        $leases = Lease::where('agency_id', $agency->id)
            ->with([
                'tenant:id,name,email,phone',
                'agent:id,name,email',
                'listing:id,title,suburb,city,primary_image,monthly_rent',
                'deposit',
            ])
            ->orderByDesc('start_date')
            ->get();

        $active   = [];
        $archived = [];

        foreach ($leases as $lease) {
            $row = $this->row($lease, $now);

            $isArchived = in_array($lease->status, ['expired', 'terminated'])
                || ($lease->end_date && $lease->end_date->isPast());

            if ($isArchived) {
                $archived[] = $row;
            } else {
                $active[] = $row;
            }
        }

        return Inertia::render('Agency/Tenants', [
            'agency'   => ['id' => $agency->id, 'name' => $agency->name],
            'active'   => $active,
            'archived' => $archived,
            'counts'   => [
                'active'   => count($active),
                'archived' => count($archived),
            ],
        ]);
    }

    private function row(Lease $lease, CarbonImmutable $now): array
    {
        $tenant  = $lease->tenant;
        $listing = $lease->listing;
        $agent   = $lease->agent;

        $daysToExpiry = $lease->end_date
            ? (int) round($now->diffInDays($lease->end_date, false))
            : null;

        return [
            'lease_id'       => $lease->id,
            'tenant_id'      => $lease->tenant_id,
            'name'           => $tenant?->name ?? '—',
            'email'          => $tenant?->email,
            'phone'          => $tenant?->phone,
            'initials'       => $this->initials($tenant?->name ?? '?'),
            'listing_id'     => $listing?->id,
            'listing_title'  => $listing?->title ?? '—',
            'listing_addr'   => trim(implode(', ', array_filter([$listing?->suburb, $listing?->city]))),
            'primary_image'  => $listing?->primary_image,
            'monthly_rent'   => (float) $lease->monthly_rent,
            'start_date'     => $lease->start_date?->format('d M Y'),
            'end_date'       => $lease->end_date?->format('d M Y'),
            'lease_status'   => $lease->status,
            'days_to_expiry' => $daysToExpiry,
            'agent_id'       => $agent?->id,
            'agent_name'     => $agent?->name,
            'agent_email'    => $agent?->email,
            'agent_initials' => $this->initials($agent?->name ?? '?'),
            'deposit_amount' => (float) $lease->deposit_amount,
            'deposit_status' => $lease->deposit?->status ?? 'due',
            'deposit_received_at' => $lease->deposit?->deposited_at?->format('d M Y'),
        ];
    }

    /**
     * Agency confirms the deposit was received into the trust account (EFT).
     * Flips the tenant portal from "deposit due" → "held" and starts PPRA interest.
     */
    public function markDepositReceived(Request $request, Lease $lease, LeaseBillingService $billing): RedirectResponse
    {
        $agency = $this->resolveAgency($request);
        abort_unless($lease->agency_id === $agency->id, 403);

        $deposit = $billing->ensureDeposit($lease);

        if ($deposit->isHeld()) {
            return back()->with('error', 'This deposit is already marked as received.');
        }

        // The received amount defaults to the lease deposit; keep whatever the
        // ledger already holds if it was set higher.
        if ((float) $deposit->amount_deposited <= 0) {
            $deposit->amount_deposited = (float) $lease->deposit_amount;
        }
        $deposit->markReceived($request->user()->id);

        return back()->with('success', 'Deposit marked as received. Interest will now accrue per the PPRA.');
    }

    private function initials(string $name): string
    {
        return collect(explode(' ', trim($name)))
            ->filter()
            ->take(2)
            ->map(fn ($w) => mb_strtoupper(mb_substr($w, 0, 1)))
            ->implode('');
    }
}
