<?php

namespace App\Services\Banking;

use App\Models\Agency;
use App\Models\Commission;
use App\Models\InvestecConnection;
use App\Models\PayoutBatch;
use App\Models\User;
use App\Notifications\CommissionPaid;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Pays a commission batch straight from the agency's Investec trust account.
 *
 * Each agent is matched to a beneficiary saved in Investec Online by bank account number.
 * Outcomes per batch:
 *   completed  — Investec accepted every payment (commissions paid, agents notified)
 *   processing — accepted but Investec needs someone to approve them in Investec Online
 *                (the agency marks the batch paid once approved)
 *   failed     — Investec refused / couldn't be reached part-way; whatever went through
 *                is recorded, the rest stays approved for the agency to settle or release
 */
class InvestecPayouts
{
    /**
     * Agents ↔ Investec beneficiaries, matched on account number.
     *
     * @param  Collection<int, User>  $agents
     * @return array<int, array{agent_id:int, agent:string, account:?string, beneficiary_id:?string, beneficiary:?string}>
     */
    public function match(InvestecConnection $c, Collection $agents, ?array $beneficiaries = null): array
    {
        $beneficiaries ??= InvestecClient::for($c)->beneficiaries();
        $byAccount = [];
        foreach ($beneficiaries as $b) {
            $digits = Agency::digits($b['accountNumber'] ?? '');
            if ($digits !== '') {
                $byAccount[$digits] ??= $b;
            }
        }

        return $agents->unique('id')->map(function (User $a) use ($byAccount) {
            $b = $byAccount[Agency::digits($a->bank_account_number)] ?? null;

            return [
                'agent_id'       => $a->id,
                'agent'          => $a->name,
                'account'        => $a->bank_account_number ? '•••• ' . substr(Agency::digits($a->bank_account_number), -4) : null,
                'beneficiary_id' => $b ? (string) $b['beneficiaryId'] : null,
                'beneficiary'    => $b ? (string) ($b['beneficiaryName'] ?? $b['name'] ?? '') : null,
            ];
        })->values()->all();
    }

    /** Is this connection paying from the agency's verified trust account? */
    public function connectionProblem(Agency $agency, ?InvestecConnection $c): ?string
    {
        if (! $c) {
            return 'Connect your Investec account under Settings → Payouts first.';
        }
        if (! $agency->trustAccountVerified()) {
            return 'Your trust account must be verified by the platform before paying from it.';
        }
        if (Agency::digits($c->account_number) !== Agency::digits($agency->trust_account_number)) {
            return 'The linked Investec account (•••• ' . substr(Agency::digits($c->account_number), -4) . ') is not your verified trust account. Reconnect Investec with the trust account.';
        }

        return null;
    }

    /**
     * Pay the batch's approved commissions. Throws InvestecException before anything is
     * sent (nothing to undo); after sending starts, problems are recorded on the batch.
     */
    public function pay(Agency $agency, PayoutBatch $batch): PayoutBatch
    {
        $c = $agency->investecConnection;
        if ($problem = $this->connectionProblem($agency, $c)) {
            throw new InvestecException($problem);
        }

        $commissions = $batch->commissions()->where('status', 'approved')->with('agent')->get();
        if ($commissions->isEmpty()) {
            throw new InvestecException('No approved commissions ready for payout.');
        }

        $client = InvestecClient::for($c);
        $matches = collect($this->match($c, $commissions->pluck('agent')->filter(), $client->beneficiaries()))->keyBy('agent_id');
        $missing = $matches->whereNull('beneficiary_id')->pluck('agent');
        if ($missing->isNotEmpty()) {
            throw new InvestecException('Add ' . $missing->implode(', ') . ' as ' . ($missing->count() === 1 ? 'a beneficiary' : 'beneficiaries')
                . ' in Investec Online (with the same account number as on their profile) and pay ' . ($missing->count() === 1 ? 'them' : 'each') . ' once, then run the payout again.');
        }

        // One payment per agent (their commissions added together).
        $lines = $commissions->groupBy('agent_id')->map(fn (Collection $rows, $agentId) => [
            'agent_id'       => (int) $agentId,
            'commissions'    => $rows,
            'beneficiaryId'  => $matches[$agentId]['beneficiary_id'],
            'amount'         => round((float) $rows->sum('agent_net'), 2),
            'myReference'    => mb_substr('PB COMM ' . $batch->id . ' ' . ($rows->first()->agent?->name ?? ''), 0, 20),
            'theirReference' => mb_substr('COMMISSION ' . strtoupper($batch->batch_date->format('M Y')), 0, 20),
        ])->values();

        // Claim the batch before any money moves, so a double click can't pay twice.
        $batch->update(['status' => 'processing', 'method' => 'investec', 'failure_reason' => null, 'total_agent_net' => (float) $lines->sum('amount')]);

        $paidAgents = [];
        $needsApproval = false;
        $failure = null;
        foreach ($lines->chunk(InvestecClient::MAX_PER_REQUEST) as $chunk) {
            try {
                $responses = $client->payMultiple($c->account_id, $chunk->values()->all());
            } catch (\Throwable $e) {
                report($e);
                $failure = $e instanceof InvestecException ? $e->getMessage() : 'Investec could not be reached while paying.';
                break;
            }
            foreach ($chunk->values() as $i => $line) {
                $r = $responses[$i] ?? null;
                $ref = $r['PaymentReferenceNumber'] ?? null;
                $approval = filter_var($r['AuthorisationRequired'] ?? false, FILTER_VALIDATE_BOOLEAN);
                $needsApproval = $needsApproval || $approval;
                foreach ($line['commissions'] as $commission) {
                    $commission->update(array_filter([
                        'payment_reference' => $ref ? mb_substr((string) $ref, 0, 80) : null,
                        'status'            => $approval ? null : 'paid',
                        'paid_at'           => $approval ? null : now(),
                    ], fn ($v) => $v !== null));
                }
                if (! $approval) {
                    $paidAgents[$line['agent_id']] = $line['commissions'];
                }
            }
        }

        DB::transaction(function () use ($batch, $failure, $needsApproval, $lines) {
            $stillOpen = $batch->commissions()->where('status', 'approved')->exists();
            $batch->update(match (true) {
                $failure !== null => ['status' => 'failed', 'failure_reason' => mb_substr($failure, 0, 300)],
                $needsApproval || $stillOpen => ['status' => 'processing'],
                default => ['status' => 'completed', 'paid_at' => now(), 'paid_reference' => 'Investec · ' . $lines->count() . ' payment' . ($lines->count() === 1 ? '' : 's')],
            });
        });

        foreach ($paidAgents as $agentId => $rows) {
            try {
                User::find($agentId)?->notify(new CommissionPaid($batch, $rows));
            } catch (\Throwable $e) {
                report($e);
            }
        }
        $c->update(['last_checked_at' => now(), 'last_error' => $failure ? mb_substr($failure, 0, 300) : null]);

        return $batch->fresh();
    }
}
