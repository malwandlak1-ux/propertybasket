<?php

namespace App\Services\Banking\H2H;

use App\Models\Agency;
use App\Models\BankFile;
use App\Models\BankLink;
use App\Models\Commission;
use App\Models\PayoutBatch;
use App\Models\User;
use App\Notifications\CommissionPaid;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Commission payouts over a host-to-host bank link.
 *
 *   send()  → pain.001 file onto the bank's SFTP. The bank books the payments against the
 *             trust account; they usually wait for the agency's approvers in online banking.
 *   poll()  → reads the bank's pain.002 status files: settled payments mark commissions paid
 *             (agents notified), rejections are recorded so the agency can fix and re-run.
 */
class H2hPayouts
{
    /**
     * Statuses that mean the money is going out. ACSP = accepted, settlement in process;
     * ACSC = settled. Confirm with each bank in its test phase.
     */
    public const PAID = ['ACSC', 'ACSP'];

    public function __construct(private Iso20022 $iso, private TransportFactory $transports) {}

    /** Why this agency can't pay through its bank link right now (null = ready). */
    public function problem(Agency $agency, ?BankLink $link): ?string
    {
        if (! $link) {
            return 'Request a direct bank link under Settings → Payouts first.';
        }
        if (! $link->canSend()) {
            return 'Your ' . $link->bankName() . ' link isn’t set up yet (stage: ' . $link->status . ').';
        }
        if (! $agency->trustAccountVerified()) {
            return 'Your trust account must be verified by the platform before paying from it.';
        }
        if ($link->bank === 'fnb' && ! preg_match('/fnb|first national/i', (string) $agency->trust_bank)) {
            return 'Your verified trust account isn’t at FNB, so it can’t be paid from the FNB link.';
        }

        return null;
    }

    public function send(Agency $agency, PayoutBatch $batch): PayoutBatch
    {
        $link = $agency->bankLink;
        if ($problem = $this->problem($agency, $link)) {
            throw new BankLinkException($problem);
        }
        $commissions = $batch->commissions()->where('status', 'approved')->with('agent')->get();
        if ($commissions->isEmpty()) {
            throw new BankLinkException('No approved commissions ready for payout.');
        }
        $noBank = $commissions->pluck('agent')->filter()->unique('id')
            ->filter(fn (User $a) => blank($a->bank_account_number) || blank($a->bank_code))->pluck('name');
        if ($noBank->isNotEmpty()) {
            throw new BankLinkException('Can’t pay yet: ' . $noBank->implode(', ') . ' ' . ($noBank->count() === 1 ? 'has' : 'have') . ' no bank account number and branch code on file.');
        }

        $profile = BankProfile::for($link->bank);
        $now = now();
        $messageId = "PB{$agency->id}-{$batch->id}-" . $now->format('ymdHis');
        $lines = $commissions->groupBy('agent_id')->map(function (Collection $rows, $agentId) use ($batch) {
            $a = $rows->first()->agent;

            return [
                'end_to_end_id' => "PB{$batch->id}A{$agentId}",
                'amount'        => round((float) $rows->sum('agent_net'), 2),
                'name'          => $a->bank_account_holder ?: $a->name,
                'account'       => (string) $a->bank_account_number,
                'branch_code'   => (string) $a->bank_code,
                'reference'     => 'COMMISSION ' . strtoupper($batch->batch_date->format('M Y')),
            ];
        })->values()->all();

        $xml = $this->iso->creditTransfer($profile, [
            'message_id'      => $messageId,
            'payment_info_id' => "PB{$batch->id}",
            'created_at'      => $now,
            'execution_date'  => $now,
            'initiator_name'  => $agency->name,
            'initiator_id'    => $link->client_code,
            'debtor_name'     => $agency->trust_account_holder ?: $agency->name,
            'debtor_account'  => (string) $agency->trust_account_number,
        ], $lines);
        $name = "PB_{$agency->id}_{$batch->id}_" . $now->format('YmdHis') . '.' . $profile->fileExtension;

        // Claim the batch first: a second click can't send a second file.
        $batch->update(['status' => 'processing', 'method' => 'bank_h2h', 'bank_message_id' => $messageId, 'failure_reason' => null,
            'total_agent_net' => array_sum(array_column($lines, 'amount'))]);

        try {
            $this->transports->for($link)->put($name, $xml);
        } catch (\Throwable $e) {
            report($e);
            $batch->update(['status' => 'pending', 'method' => null, 'bank_message_id' => null]);
            $link->update(['last_error' => mb_substr($e->getMessage(), 0, 300)]);
            throw $e instanceof BankLinkException ? $e : new BankLinkException('Couldn’t send the payment file to ' . $profile->name . '.', previous: $e);
        }

        $path = "bank-files/{$link->id}/out/{$name}";
        Storage::disk('local')->put($path, $xml);
        BankFile::create(['bank_link_id' => $link->id, 'payout_batch_id' => $batch->id, 'direction' => 'out', 'name' => $name, 'message_id' => $messageId,
            'kind' => $profile->painVersion, 'storage_path' => $path, 'summary' => count($lines) . ' payment(s), R ' . number_format(array_sum(array_column($lines, 'amount')), 2)]);
        $commissions->each->update(['bank_status' => 'SENT']);
        $link->update(['last_error' => null]);

        return $batch->fresh();
    }

    /** Collect and apply the bank's status files. Returns how many new files were read. */
    public function poll(BankLink $link): int
    {
        $transport = $this->transports->for($link);
        $seen = $link->files()->where('direction', 'in')->pluck('name')->all();
        $read = 0;
        try {
            foreach (array_diff($transport->list(), $seen) as $name) {
                $data = $transport->get($name);
                $path = "bank-files/{$link->id}/in/{$name}";
                Storage::disk('local')->put($path, $data);
                $read++;
                try {
                    $report = $this->iso->statusReport($data);
                } catch (\InvalidArgumentException) {
                    BankFile::create(['bank_link_id' => $link->id, 'direction' => 'in', 'name' => $name, 'kind' => 'other', 'storage_path' => $path, 'summary' => 'Not a payment status report — kept for reference.']);
                    continue;
                }
                $batch = $report['message_id']
                    ? PayoutBatch::where('agency_id', $link->agency_id)->where('bank_message_id', $report['message_id'])->first()
                    : null;
                $summary = $batch ? $this->apply($batch, $report) : 'Status for an unknown payment file (' . ($report['message_id'] ?? 'no id') . ').';
                BankFile::create(['bank_link_id' => $link->id, 'payout_batch_id' => $batch?->id, 'direction' => 'in', 'name' => $name,
                    'message_id' => $report['message_id'], 'kind' => 'pain.002', 'storage_path' => $path, 'summary' => mb_substr($summary, 0, 300)]);
            }
            $link->update(['last_polled_at' => now(), 'last_error' => null]);
        } catch (\Throwable $e) {
            report($e);
            $link->update(['last_polled_at' => now(), 'last_error' => mb_substr($e->getMessage(), 0, 300)]);
            throw $e instanceof BankLinkException ? $e : new BankLinkException('Couldn’t read status files from the bank.', previous: $e);
        }

        return $read;
    }

    /** Apply one status report to its batch. Returns a one-line summary. */
    private function apply(PayoutBatch $batch, array $report): string
    {
        $commissions = $batch->commissions()->get()->groupBy('agent_id');
        $groupRejected = strtoupper((string) $report['group_status']) === 'RJCT';
        $paidNow = [];
        $rejected = [];

        DB::transaction(function () use ($batch, $commissions, $report, $groupRejected, &$paidNow, &$rejected) {
            foreach ($commissions as $agentId => $rows) {
                $tx = $report['transactions']["PB{$batch->id}A{$agentId}"] ?? null;
                $status = strtoupper((string) ($tx['status'] ?? ($groupRejected ? 'RJCT' : '')));
                if ($status === '') {
                    continue; // not in this report
                }
                $reason = $tx['reason'] ?? ($groupRejected ? $report['group_reason'] : null);
                foreach ($rows as $c) {
                    if ($c->status === 'paid') {
                        continue;
                    }
                    if (in_array($status, self::PAID, true)) {
                        $c->update(['status' => 'paid', 'paid_at' => now(), 'bank_status' => $status]);
                        $paidNow[$agentId][] = $c;
                    } else {
                        $c->update(['bank_status' => mb_substr($status . ($reason ? " {$reason}" : ''), 0, 40)]);
                        if ($status === 'RJCT') {
                            $rejected[$agentId] = $reason;
                        }
                    }
                }
            }

            $open = $batch->commissions()->where('status', 'approved')->get();
            $waiting = $open->contains(fn (Commission $c) => ! str_starts_with((string) $c->bank_status, 'RJCT'));
            if ($open->isEmpty()) {
                $batch->update(['status' => 'completed', 'paid_at' => now(), 'paid_reference' => 'Bank ' . $report['message_id']]);
            } elseif (! $waiting) {
                $names = User::whereIn('id', array_keys($rejected))->pluck('name')->implode(', ');
                $batch->update(['status' => 'failed', 'failure_reason' => mb_substr('The bank rejected payment(s) to ' . ($names ?: 'some agents')
                    . ($rejected ? ': ' . implode('; ', array_unique(array_filter($rejected))) : '') . '.', 0, 300)]);
            }
        });

        foreach ($paidNow as $agentId => $rows) {
            try {
                User::find($agentId)?->notify(new CommissionPaid($batch, collect($rows)));
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return sprintf('%s: %d agent(s) paid, %d rejected.', $report['group_status'] ?: 'Status', count($paidNow), count($rejected));
    }
}
