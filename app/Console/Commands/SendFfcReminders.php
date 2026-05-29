<?php

namespace App\Console\Commands;

use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Notifications\AgencyFfcExpiring;
use App\Notifications\FfcExpiring;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

class SendFfcReminders extends Command
{
    protected $signature = 'ffc:remind';

    protected $description = 'Email agents and agencies whose FFC expires within 30 days.';

    public function handle(): int
    {
        $today  = CarbonImmutable::now()->startOfDay();
        $cutoff = $today->addDays(30)->endOfDay();

        // ── Agents ────────────────────────────────────────────────────────
        $pivots = AgencyAgent::with('user')
            ->whereNotNull('ffc_expires_at')
            ->whereBetween('ffc_expires_at', [$today, $cutoff])
            ->where('status', 'active')
            ->whereNull('ffc_reminder_sent_at')
            ->get();

        $agentSent = 0;
        foreach ($pivots as $pivot) {
            $daysLeft = (int) round($today->diffInDays($pivot->ffc_expires_at->startOfDay(), false));
            $pivot->user?->notify(new FfcExpiring($pivot, $daysLeft));
            $pivot->update(['ffc_reminder_sent_at' => now()]);
            $agentSent++;
        }

        // ── Agencies ──────────────────────────────────────────────────────
        $agencies = Agency::with('owner')
            ->whereNotNull('eaab_ffc_expires_at')
            ->whereBetween('eaab_ffc_expires_at', [$today, $cutoff])
            ->whereNull('eaab_reminder_sent_at')
            ->get();

        $agencySent = 0;
        foreach ($agencies as $agency) {
            $daysLeft = (int) round($today->diffInDays($agency->eaab_ffc_expires_at->startOfDay(), false));
            $agency->owner?->notify(new AgencyFfcExpiring($agency, $daysLeft));
            $agency->update(['eaab_reminder_sent_at' => now()]);
            $agencySent++;
        }

        $this->info("FFC reminders sent — agents: {$agentSent}, agencies: {$agencySent}");
        return self::SUCCESS;
    }
}
