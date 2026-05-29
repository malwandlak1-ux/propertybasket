<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Tenant\Concerns\ResolvesTenant;
use App\Models\DebitOrder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class DebitOrderController extends Controller
{
    use ResolvesTenant;

    /**
     * POST /tenant/debit-order
     * Sets up (or replaces) the tenant's debit-order mandate on their active lease.
     */
    public function store(Request $request): RedirectResponse
    {
        $lease = $this->resolveLease($request);
        $user  = $request->user();

        $data = $request->validate([
            'bank_name'      => ['required', 'string', 'max:120'],
            'account_holder' => ['required', 'string', 'max:160'],
            'account_number' => ['required', 'string', 'max:32'],
            'branch_code'    => ['required', 'string', 'max:12'],
            'account_type'   => ['required', 'in:cheque,current,savings'],
            'debit_day'      => ['required', 'integer', 'min:1', 'max:28'],
        ]);

        // Cancel any existing active mandate so we always have a single source of truth.
        DebitOrder::where('lease_id', $lease->id)
            ->where('status', 'active')
            ->update(['status' => 'cancelled', 'cancelled_at' => now()]);

        DebitOrder::create([
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

        return back()->with('success', "Debit order set up. We'll collect rent on day {$data['debit_day']} each month from your {$data['bank_name']} account.");
    }

    /**
     * POST /tenant/debit-order/cancel
     */
    public function cancel(Request $request): RedirectResponse
    {
        $lease = $this->resolveLease($request);

        DebitOrder::where('lease_id', $lease->id)
            ->where('status', 'active')
            ->update(['status' => 'cancelled', 'cancelled_at' => now()]);

        return back()->with('success', 'Debit order cancelled. You can set up a new one any time.');
    }
}
