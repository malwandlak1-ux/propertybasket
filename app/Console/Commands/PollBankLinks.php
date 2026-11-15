<?php

namespace App\Console\Commands;

use App\Models\BankLink;
use App\Models\PayoutBatch;
use App\Services\Banking\H2H\H2hPayouts;
use Illuminate\Console\Command;

/** Collect payment status files from agencies' host-to-host bank links. */
class PollBankLinks extends Command
{
    protected $signature = 'bank:poll';

    protected $description = 'Read bank status files (pain.002) for payouts sent over host-to-host links.';

    public function handle(H2hPayouts $payouts): int
    {
        // Only links with a payout still waiting on the bank.
        $agencyIds = PayoutBatch::where('method', 'bank_h2h')->where('status', 'processing')->pluck('agency_id')->unique();
        foreach (BankLink::whereIn('agency_id', $agencyIds)->get()->filter->canSend() as $link) {
            try {
                $n = $payouts->poll($link);
                $this->line("Link #{$link->id}: {$n} new file(s).");
            } catch (\Throwable $e) {
                $this->warn("Link #{$link->id}: {$e->getMessage()}");
            }
        }

        return self::SUCCESS;
    }
}
