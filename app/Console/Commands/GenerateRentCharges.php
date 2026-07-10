<?php

namespace App\Console\Commands;

use App\Models\Lease;
use App\Services\LeaseBillingService;
use Illuminate\Console\Command;

class GenerateRentCharges extends Command
{
    protected $signature = 'rent:generate';

    protected $description = 'Raise monthly rent charges (pay-and-stay), mark arrears overdue, ensure deposits, and accrue PPRA deposit interest.';

    public function handle(LeaseBillingService $billing): int
    {
        $leases = Lease::whereIn('status', ['active', 'pending'])->get();

        $charged = 0;
        foreach ($leases as $lease) {
            $billing->ensureCharges($lease);

            $deposit = $billing->ensureDeposit($lease);
            $billing->accrueDepositInterest($deposit);

            $charged++;
        }

        $this->info("Rent ledger reconciled for {$charged} active/pending lease(s).");

        return self::SUCCESS;
    }
}
