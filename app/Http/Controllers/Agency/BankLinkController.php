<?php

namespace App\Http\Controllers\Agency;

use App\Enums\Role;
use App\Enums\UserStatus;
use App\Http\Controllers\Agency\Concerns\ResolvesAgency;
use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\BankLink;
use App\Models\User;
use App\Notifications\BankLinkRequested;
use App\Services\Banking\H2H\BankProfile;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Agency side: ask for a direct (host-to-host) bank link, or withdraw the request. */
class BankLinkController extends Controller
{
    use ResolvesAgency;

    /** POST /agency/payouts/bank-link */
    public function request(Request $request): RedirectResponse
    {
        $agency = $this->adminAgency($request);
        $data = $request->validate([
            'bank'          => ['required', Rule::in(array_keys(BankProfile::supported()))],
            'contact_name'  => ['required', 'string', 'max:120'],
            'contact_email' => ['required', 'email', 'max:180'],
            'contact_phone' => ['nullable', 'string', 'max:40'],
            'banker_name'   => ['nullable', 'string', 'max:120'],
            'banker_email'  => ['nullable', 'email', 'max:180'],
            'notes'         => ['nullable', 'string', 'max:1000'],
        ]);
        if ($agency->bankLink && $agency->bankLink->status !== 'paused') {
            return back()->with('error', 'You already have a bank link request (' . $agency->bankLink->status . ').');
        }

        $link = BankLink::updateOrCreate(['agency_id' => $agency->id], $data + ['status' => 'requested', 'requested_at' => now()]);

        foreach (User::where('role', Role::SuperAdmin)->where('status', UserStatus::Active)->get() as $admin) {
            try {
                $admin->notify(new BankLinkRequested($link));
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return back()->with('success', 'Request sent. Next step: ask your ' . $link->bankName() . ' relationship banker for a host-to-host agreement for your trust account. We will guide you through each stage.');
    }

    /** DELETE /agency/payouts/bank-link — withdraw a request that isn't live yet. */
    public function cancel(Request $request): RedirectResponse
    {
        $agency = $this->adminAgency($request);
        $link = $agency->bankLink;
        if (! $link) {
            return back();
        }
        if ($link->status === 'live') {
            return back()->with('error', 'Your bank link is live. Contact support to switch it off.');
        }
        $link->delete();
        if ($agency->payout_method === 'bank_h2h') {
            $agency->update(['payout_method' => $agency->trustAccountVerified() ? 'trust_account' : 'paystack']);
        }

        return back()->with('success', 'Bank link request withdrawn.');
    }

    private function adminAgency(Request $request): Agency
    {
        abort_unless(in_array($request->user()->role, [Role::AgencyAdmin, Role::SuperAdmin], true), 403, 'Only an agency admin can manage payouts.');

        return $this->resolveAgency($request);
    }
}
