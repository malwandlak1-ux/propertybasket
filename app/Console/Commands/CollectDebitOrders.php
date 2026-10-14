<?php

namespace App\Console\Commands;

use App\Services\DebitOrderCollector;
use Illuminate\Console\Command;

class CollectDebitOrders extends Command
{
    protected $signature = 'debit:collect';

    protected $description = 'Collect rent on active debit orders whose debit date has arrived';

    public function handle(DebitOrderCollector $collector): int
    {
        if (! $collector->enabled()) {
            $this->warn('Debit-order collection is disabled (no provider configured).');

            return self::SUCCESS;
        }

        $r = $collector->run();
        $this->info("Debit orders: {$r['succeeded']} collected, {$r['failed']} failed ({$collector->driver()} driver).");

        return self::SUCCESS;
    }
}
