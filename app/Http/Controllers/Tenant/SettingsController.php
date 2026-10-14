<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Tenant\Concerns\ResolvesTenant;
use App\Models\DebitOrder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    use ResolvesTenant;

    public function show(Request $request): Response
    {
        $lease = $this->resolveLease($request);
        $user  = $request->user();

        return Inertia::render('Tenant/Settings', [
            'tenant' => [
                'id'   => $user->id,
                'name' => $user->name,
            ],
            'lease' => [
                'address'      => trim($lease->listing?->address ?? $lease->listing?->title ?? ''),
                'suburb'       => $lease->listing?->suburb,
                'city'         => $lease->listing?->city,
                'monthly_rent' => (float) $lease->monthly_rent,
            ],
            'profile' => [
                'name'  => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
            ],
            'banking' => [
                'bank_name'           => $user->bank_name,
                'bank_account_holder' => $user->bank_account_holder,
                'bank_account_number' => $user->bank_account_number,
                'bank_branch_code'    => $user->bank_code,
                'bank_account_type'   => $user->bank_account_type,
                'complete'            => DebitOrderController::hasSavedBanking($user),
            ],
            'debit_order' => $this->debitOrder($lease),
            'managed_by'  => $lease->agency?->name ?? $lease->landlord?->name,
            'banks'       => self::BANKS,
        ]);
    }

    public function updateProfile(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'name'  => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:180', 'unique:users,email,' . $user->id],
            'phone' => ['nullable', 'string', 'max:30'],
        ]);

        $user->update($data);

        return back()->with('success', 'Your contact details have been updated.');
    }

    /**
     * PATCH /tenant/settings/banking — the tenant's own account (debit-order
     * source, deposit refunds). An active debit order follows the new
     * account, and the landlord is told.
     */
    public function updateBanking(Request $request): RedirectResponse
    {
        $lease = $this->resolveLease($request);
        $user  = $request->user();

        $data = $request->validate([
            'bank_name'           => ['required', 'string', 'max:120'],
            'bank_account_holder' => ['required', 'string', 'max:160'],
            'bank_account_number' => ['required', 'regex:/^[0-9 ]{6,20}$/'],
            'bank_branch_code'    => ['required', 'regex:/^[0-9]{4,8}$/'],
            'bank_account_type'   => ['required', 'in:cheque,current,savings'],
        ], [
            'bank_account_number.regex' => 'Account numbers are digits only (6 to 20).',
            'bank_branch_code.regex'    => 'Branch codes are 4 to 8 digits.',
        ]);

        $user->forceFill([
            'bank_name'           => $data['bank_name'],
            'bank_account_holder' => $data['bank_account_holder'],
            'bank_account_number' => str_replace(' ', '', $data['bank_account_number']),
            'bank_code'           => $data['bank_branch_code'],
            'bank_account_type'   => $data['bank_account_type'],
        ])->save();

        $active = DebitOrder::where('lease_id', $lease->id)->where('status', 'active')->latest('id')->first();
        if ($active && ($active->account_number !== $user->bank_account_number || $active->branch_code !== $user->bank_code
            || $active->bank_name !== $user->bank_name || $active->account_type !== $user->bank_account_type
            || $active->account_holder !== $user->bank_account_holder)) {
            $active->update([
                'bank_name'      => $user->bank_name,
                'account_holder' => $user->bank_account_holder,
                'account_number' => $user->bank_account_number,
                'branch_code'    => $user->bank_code,
                'account_type'   => $user->bank_account_type,
                'signed_at'      => now(),
            ]);
            DebitOrderController::notifyManager($lease, $active->fresh(), 'updated');

            return back()->with('success', 'Banking details saved. Your debit order now uses this account.');
        }

        return back()->with('success', 'Banking details saved.');
    }

    public function updatePassword(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'current_password' => ['required', 'current_password'],
            'password'         => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user->update(['password' => bcrypt($data['password'])]);

        return back()->with('success', 'Password updated.');
    }

    public const BANKS = [
        'ABSA Bank', 'African Bank', 'Bidvest Bank', 'Capitec Bank', 'Discovery Bank',
        'First National Bank (FNB)', 'Investec', 'Nedbank', 'Standard Bank', 'TymeBank',
    ];

    private function debitOrder(\App\Models\Lease $lease): ?array
    {
        $do = DebitOrder::where('lease_id', $lease->id)->where('status', 'active')->latest('id')->first();
        if (! $do) {
            return null;
        }

        $next = $do->nextDebitDate();
        $collector = app(\App\Services\DebitOrderCollector::class);

        return [
            'next_date'      => $next->format('d M Y'),
            'next_amount'    => app(\App\Services\LeaseBillingService::class)->rentForPeriod($lease, $next->startOfMonth()),
            'simulated'      => $collector->driver() === 'stub',
            'collecting'     => $collector->enabled(),
            'collections'    => \App\Models\DebitOrderCollection::where('lease_id', $lease->id)
                ->with('rentPayment:id,period_month')
                ->latest('id')->take(6)->get()
                ->map(fn ($c) => [
                    'id'     => $c->id,
                    'date'   => $c->attempted_at?->format('d M Y'),
                    'period' => $c->rentPayment ? \Carbon\CarbonImmutable::parse($c->rentPayment->period_month . '-01')->format('F Y') : null,
                    'amount' => (float) $c->amount,
                    'status' => $c->status,
                    'reason' => $c->failure_reason,
                ])->values()->all(),
            'bank_name'      => $do->bank_name,
            'account_holder' => $do->account_holder,
            'account_masked' => str_repeat('•', max(strlen((string) $do->account_number) - 4, 0)) . substr((string) $do->account_number, -4),
            'account_type'   => $do->account_type,
            'debit_day'      => $do->debit_day,
            'signed_at'      => $do->signed_at?->format('d M Y'),
        ];
    }
}
