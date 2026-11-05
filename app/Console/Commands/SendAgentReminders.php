<?php

namespace App\Console\Commands;

use App\Models\AgentReminder;
use App\Notifications\ReminderDue;
use Illuminate\Console\Command;

/** Ring the bell for agent calendar reminders whose time has come (once each). */
class SendAgentReminders extends Command
{
    protected $signature = 'reminders:send';

    protected $description = "Notify agents of calendar reminders that are due";

    public function handle(): int
    {
        $sent = 0;

        AgentReminder::with('agent')
            ->whereNull('notified_at')
            ->whereNull('done_at')
            ->where('remind_at', '<=', now())
            ->orderBy('remind_at')
            ->limit(500)
            ->get()
            ->each(function (AgentReminder $r) use (&$sent) {
                $r->agent?->notify(new ReminderDue($r));
                $r->update(['notified_at' => now()]);
                $sent++;
            });

        $this->info("Sent {$sent} reminder(s).");

        return self::SUCCESS;
    }
}
