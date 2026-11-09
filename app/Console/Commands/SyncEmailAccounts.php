<?php

namespace App\Console\Commands;

use App\Models\EmailAccount;
use App\Services\Mail\EmailService;
use Illuminate\Console\Command;

/** Pull new mail for every connected mailbox (Messages → Email). */
class SyncEmailAccounts extends Command
{
    protected $signature = 'email:sync';

    protected $description = 'Download new messages for connected email accounts';

    public function handle(EmailService $mail): int
    {
        $total = 0;
        EmailAccount::query()->orderBy('last_synced_at')->each(function (EmailAccount $a) use ($mail, &$total) {
            try {
                $total += $mail->sync($a);
            } catch (\Throwable $e) {
                $this->warn("{$a->email}: {$e->getMessage()}");
            }
        });
        $this->info("{$total} new message(s).");

        return self::SUCCESS;
    }
}
