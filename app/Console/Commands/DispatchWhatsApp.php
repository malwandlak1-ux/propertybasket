<?php

namespace App\Console\Commands;

use App\Services\WhatsApp\WhatsAppService;
use Illuminate\Console\Command;

class DispatchWhatsApp extends Command
{
    protected $signature = 'whatsapp:dispatch {--limit= : Max messages this run}';

    protected $description = 'Send queued CRM WhatsApp campaign messages (throttled, inside the send window)';

    public function handle(WhatsAppService $wa): int
    {
        $n = $wa->dispatch($this->option('limit') ? (int) $this->option('limit') : null);
        $this->info("{$n} WhatsApp messages sent.");

        return self::SUCCESS;
    }
}
