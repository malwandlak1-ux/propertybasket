<?php

namespace App\Services;

use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\Commission;
use App\Models\Lease;
use App\Models\Listing;
use App\Models\PayoutBatch;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class CommissionService
{
    /**
     * Compute and persist a commission row for a closed deal.
     *
     * For rentals the deal_value is one year's worth of rent. For sales it is
     * the sale price. The agency's commission rate is currently a flat 7.5%
     * (rentals) / 6% (sales) since the spec doesn't capture a per-agency rate
     * — this is intentionally configurable in one place.
     */
    public function calculate(Lease $lease, User $agent, string $dealType = 'rental'): Commission
    {
        $listing = $lease->listing;
        $agency = $this->agencyFor($listing);

        if (! $agency) {
            throw new \RuntimeException('Commission can only be calculated for agency-owned deals.');
        }

        $pivot = AgencyAgent::where('agency_id', $agency->id)
            ->where('user_id', $agent->id)
            ->firstOrFail();

        [$dealValue, $grossRate] = match ($dealType) {
            'sale' => [(float) $listing->sale_price, 0.06],
            default => [(float) $lease->monthly_rent * 12, 0.075],
        };

        $grossCommission = round($dealValue * $grossRate, 2);
        $agentSplit = (float) $pivot->commission_split_percent;
        $agentAmount = round($grossCommission * $agentSplit / 100, 2);
        $agencyAmount = round($grossCommission - $agentAmount, 2);

        $vatRate = $agency->vat_registered ? (float) $agency->vat_rate : 0.0;
        $vatAmount = round($agentAmount * $vatRate / 100, 2);
        $agentNet = round($agentAmount - $vatAmount, 2);

        $commission = Commission::create([
            'agency_id' => $agency->id,
            'agent_id' => $agent->id,
            'deal_type' => $dealType,
            'listing_id' => $listing->id,
            'lease_id' => $lease->id,
            'deal_value' => $dealValue,
            'gross_commission' => $grossCommission,
            'agent_split_percent' => $agentSplit,
            'agent_amount' => $agentAmount,
            'agency_amount' => $agencyAmount,
            'vat_amount' => $vatAmount,
            'agent_net' => $agentNet,
            'status' => 'pending',
        ]);

        $this->blockIfNonCompliant($commission);

        return $commission;
    }

    /**
     * Mark a commission `blocked` if the agent can't legally be paid out yet.
     * Returns true if the commission was blocked, false if it stays as-is.
     */
    public function blockIfNonCompliant(Commission $commission): bool
    {
        $agent = $commission->agent;
        $pivot = AgencyAgent::where('agency_id', $commission->agency_id)
            ->where('user_id', $agent->id)
            ->first();

        $reasons = [];

        if (empty($agent->paystack_recipient_code)) {
            $reasons[] = 'paystack_missing';
        }
        if ($pivot && $pivot->ffc_expires_at && $pivot->ffc_expires_at->isPast()) {
            $reasons[] = 'ffc_expired';
        }

        if (! empty($reasons)) {
            $commission->update([
                'status' => 'blocked',
                'blocked_reason' => implode(',', $reasons),
            ]);

            return true;
        }

        return false;
    }

    /**
     * Bundle this agency's `approved` commissions for the current month into a
     * PayoutBatch ready for admin approval (or, if invoked after approval, for
     * PaystackService::runPayoutBatch). Returns the batch (existing or new).
     */
    public function runMonthlyBatch(Agency $agency, ?CarbonImmutable $batchDate = null): PayoutBatch
    {
        $batchDate = $batchDate ?? CarbonImmutable::now()->day($agency->payout_day ?? 25);

        return DB::transaction(function () use ($agency, $batchDate) {
            $commissions = Commission::where('agency_id', $agency->id)
                ->whereIn('status', ['pending', 'approved'])
                ->whereNull('payout_batch_id')
                ->get();

            $totalGross = (float) $commissions->sum('gross_commission');
            $totalVat = (float) $commissions->sum('vat_amount');
            $totalAgentNet = (float) $commissions->sum('agent_net');

            $batch = PayoutBatch::create([
                'agency_id' => $agency->id,
                'batch_date' => $batchDate->toDateString(),
                'total_gross' => $totalGross,
                'total_vat' => $totalVat,
                'total_agent_net' => $totalAgentNet,
                'status' => 'pending',
            ]);

            $commissions->each->update([
                'payout_batch_id' => $batch->id,
                'payout_batch_date' => $batch->batch_date,
            ]);

            return $batch;
        });
    }

    private function agencyFor(Listing $listing): ?Agency
    {
        if ($listing->owner_type !== Agency::class) {
            return null;
        }

        return $listing->owner instanceof Agency
            ? $listing->owner
            : Agency::find($listing->owner_id);
    }
}
