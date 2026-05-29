<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Tenant\Concerns\ResolvesTenant;
use App\Models\Deposit;
use App\Models\Inspection;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DocumentsController extends Controller
{
    use ResolvesTenant;

    public function index(Request $request): Response
    {
        $lease = $this->resolveLease($request);
        $user  = $request->user();
        $now   = CarbonImmutable::now();
        $start = CarbonImmutable::parse($lease->start_date);

        $deposit = Deposit::where('lease_id', $lease->id)->first();
        $depositInfo = [
            'amount_deposited' => (float) ($deposit?->amount_deposited ?? $lease->deposit_amount ?? 0),
            'accrued_interest' => (float) ($deposit?->accrued_interest ?? 0),
            'interest_rate'    => (float) ($deposit?->interest_rate ?? $lease->deposit_interest_rate ?? 6.75),
            'total_held'       => (float) (($deposit?->amount_deposited ?? $lease->deposit_amount ?? 0) + ($deposit?->accrued_interest ?? 0)),
            'deposited_at'     => ($deposit?->deposited_at ?? $start)->format('d M Y'),
        ];

        // Inspections this tenant is party to
        $inspections = Inspection::where('lease_id', $lease->id)
            ->orderBy('type')
            ->get()
            ->map(function (Inspection $i) {
                $rooms = is_array($i->rooms) ? $i->rooms : [];
                $photoCount = 0;
                foreach ($rooms as $r) {
                    $photoCount += count($r['photos'] ?? []);
                }

                return [
                    'id'              => $i->id,
                    'type'            => $i->type,
                    'status'          => $i->status,
                    'date'            => $i->updated_at?->format('d M Y'),
                    'photo_count'     => $photoCount,
                    'room_count'      => count($rooms),
                    'agent_signed'    => ! is_null($i->agent_signed_at),
                    'tenant_signed'   => ! is_null($i->tenant_signed_at),
                ];
            });

        // Synthetic document set (real upload pipeline is a Phase 9 task)
        $documents = [
            [
                'id'       => 'lease',
                'title'    => 'Lease Agreement',
                'subtitle' => 'Master lease',
                'meta'     => $lease->signed_at?->format('d M Y') ?? $start->format('d M Y'),
                'tone'     => 'rose',
                'signed'   => true,
                'category' => 'lease',
            ],
            [
                'id'       => 'house-rules',
                'title'    => 'House Rules',
                'subtitle' => 'Body corporate conduct',
                'meta'     => $start->format('d M Y'),
                'tone'     => 'emerald',
                'signed'   => true,
                'category' => 'lease',
            ],
            [
                'id'       => 'deposit-receipt',
                'title'    => 'Deposit Receipt',
                'subtitle' => 'Section 32 trust',
                'meta'     => $start->format('d M Y'),
                'tone'     => 'brand',
                'signed'   => true,
                'category' => 'lease',
            ],
        ];

        // ── Deposit trust ledger (synthesised from accrual data) ─────────────
        $ledger = $this->buildLedger($lease, $deposit, $depositInfo);

        return Inertia::render('Tenant/Documents', [
            'tenant' => [
                'id'   => $user->id,
                'name' => $user->name,
            ],
            'lease' => [
                'id'           => $lease->id,
                'address'      => $lease->listing?->address ?? $lease->listing?->title ?? '',
                'monthly_rent' => (float) $lease->monthly_rent,
                'start_date'   => $start->format('Y/m/d'),
                'end_date'     => CarbonImmutable::parse($lease->end_date)->format('Y/m/d'),
            ],
            'deposit'     => $depositInfo,
            'ledger'      => $ledger,
            'documents'   => $documents,
            'inspections' => $inspections,
        ]);
    }

    private function buildLedger($lease, ?Deposit $deposit, array $info): array
    {
        $rows = [];
        $start = CarbonImmutable::parse($lease->start_date);
        $depositedAt = $deposit?->deposited_at
            ? CarbonImmutable::parse($deposit->deposited_at)
            : $start;

        $rows[] = [
            'date'        => $depositedAt->format('Y/m/d'),
            'description' => 'Damage deposit',
            'sub'         => 'Lease commencement',
            'type'        => 'DEPOSIT',
            'tone'        => 'brand',
            'amount'      => $info['amount_deposited'],
            'balance'     => $info['amount_deposited'],
        ];

        // Add 1-3 synthesised interest accruals if interest > 0
        $running = $info['amount_deposited'];
        $interest = $info['accrued_interest'];
        if ($interest > 0) {
            $now = CarbonImmutable::now();
            $months = max(1, (int) floor($depositedAt->diffInDays($now) / 30.44));
            $perMonth = $interest / max(1, $months);
            $cursor = $depositedAt->day(1)->addMonth();
            $count = 0;
            while ($cursor->lessThan($now) && $count < 6) {
                $running += $perMonth;
                array_unshift($rows, [
                    'date'        => $cursor->format('Y/m/d'),
                    'description' => 'Monthly interest accrual',
                    'sub'         => null,
                    'type'        => 'INTEREST',
                    'tone'        => 'success',
                    'amount'      => $perMonth,
                    'balance'     => $running,
                ]);
                $cursor = $cursor->addMonth();
                $count++;
            }
        }

        return $rows;
    }
}
