<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Tenant\Concerns\ResolvesTenant;
use App\Models\DebitOrder;
use App\Models\Lease;
use App\Models\User;
use App\Notifications\DebitOrderChanged;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class DebitOrderController extends Controller
{
    use ResolvesTenant;

    /**
     * POST /tenant/debit-order
     * Sets up (or replaces) the tenant's debit-order mandate on their active
     * lease. Bank details come from the request (Overview modal) or, when
     * left out, from the banking saved in the tenant's Settings.
     */
    public function store(Request $request): RedirectResponse
    {
        $lease = $this->resolveLease($request);
        $user  = $request->user();

        $usingSaved = ! $request->filled('account_number');

        if ($usingSaved) {
            $request->validate([
                'debit_day' => ['required', 'integer', 'min:1', 'max:28'],
                'authorise' => ['accepted'],
            ], ['authorise.accepted' => 'Tick the box to authorise the debit order.']);

            if (! self::hasSavedBanking($user)) {
                return back()->withErrors(['debit_day' => 'Add your banking details first.']);
            }

            $data = [
                'bank_name'      => $user->bank_name,
                'account_holder' => $user->bank_account_holder,
                'account_number' => $user->bank_account_number,
                'branch_code'    => $user->bank_code,
                'account_type'   => $user->bank_account_type,
                'debit_day'      => (int) $request->input('debit_day'),
            ];
        } else {
            $data = $request->validate([
                'bank_name'      => ['required', 'string', 'max:120'],
                'account_holder' => ['required', 'string', 'max:160'],
                'account_number' => ['required', 'string', 'max:32'],
                'branch_code'    => ['required', 'string', 'max:12'],
                'account_type'   => ['required', 'in:cheque,current,savings'],
                'debit_day'      => ['required', 'integer', 'min:1', 'max:28'],
            ]);
        }

        $hadOne = DebitOrder::where('lease_id', $lease->id)->where('status', 'active')->exists();

        // Cancel any existing active mandate so we always have a single source of truth.
        DebitOrder::where('lease_id', $lease->id)
            ->where('status', 'active')
            ->update(['status' => 'cancelled', 'cancelled_at' => now()]);

        $debitOrder = DebitOrder::create([
            'lease_id'       => $lease->id,
            'tenant_id'      => $user->id,
            'bank_name'      => $data['bank_name'],
            'account_holder' => $data['account_holder'],
            'account_number' => $data['account_number'],
            'branch_code'    => $data['branch_code'],
            'account_type'   => $data['account_type'],
            'debit_day'      => $data['debit_day'],
            'status'         => 'active',
            'signed_at'      => now(),
        ]);

        self::notifyManager($lease, $debitOrder, $hadOne ? 'updated' : 'activated');

        return back()->with('success', "Debit order active. Rent will be collected on day {$data['debit_day']} each month from your {$data['bank_name']} account.");
    }

    /**
     * POST /tenant/debit-order/cancel
     */
    public function cancel(Request $request): RedirectResponse
    {
        $lease = $this->resolveLease($request);

        $active = DebitOrder::where('lease_id', $lease->id)->where('status', 'active')->latest('id')->first();

        DebitOrder::where('lease_id', $lease->id)
            ->where('status', 'active')
            ->update(['status' => 'cancelled', 'cancelled_at' => now()]);

        if ($active) {
            self::notifyManager($lease, $active->fresh(), 'cancelled');
        }

        return back()->with('success', 'Debit order cancelled. You can set up a new one any time.');
    }

    public static function hasSavedBanking(User $user): bool
    {
        return ! empty($user->bank_name) && ! empty($user->bank_account_holder)
            && ! empty($user->bank_account_number) && ! empty($user->bank_code)
            && ! empty($user->bank_account_type);
    }

    /** Tell the landlord (or agency owner) who manages this lease. Never fails the request. */
    public static function notifyManager(Lease $lease, DebitOrder $debitOrder, string $event): void
    {
        $lease->loadMissing(['landlord', 'agency.owner']);
        $manager = $lease->agency?->owner ?? $lease->landlord;

        try {
            $manager?->notify(new DebitOrderChanged($debitOrder, $event));
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
