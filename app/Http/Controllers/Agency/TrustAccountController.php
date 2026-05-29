<?php

namespace App\Http\Controllers\Agency;

use App\Http\Controllers\Agency\Concerns\ResolvesAgency;
use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TrustAccountController extends Controller
{
    use ResolvesAgency;

    /**
     * SA Property Practitioners Act s54 requires every property practitioner who
     * handles client money to operate a Trust Account, audited annually by an
     * IRBA-registered auditor. This screen captures the details the PPRA inspects.
     */
    public function show(Request $request): Response
    {
        $agency = $this->resolveAgency($request);

        $hasAccount = ! empty($agency->trust_bank)
            && ! empty($agency->trust_account_number)
            && ! empty($agency->trust_branch_code)
            && ! empty($agency->trust_account_holder);

        $hasAuditor = ! empty($agency->trust_auditor_name)
            && ! empty($agency->trust_auditor_practice_number);

        $state = match (true) {
            $agency->trust_verified_at !== null => 'verified',
            $hasAccount && $hasAuditor          => 'pending_review',
            $hasAccount || $hasAuditor          => 'partial',
            default                              => 'not_started',
        };

        return Inertia::render('Agency/TrustAccount', [
            'agency' => ['id' => $agency->id, 'name' => $agency->name],
            'trust'  => [
                'bank'                      => $agency->trust_bank,
                'account_number'            => $agency->trust_account_number,
                'branch_code'               => $agency->trust_branch_code,
                'account_holder'            => $agency->trust_account_holder,
                'account_type'              => $agency->trust_account_type,
                'auditor_name'              => $agency->trust_auditor_name,
                'auditor_practice_number'   => $agency->trust_auditor_practice_number,
                'verified_at'               => $agency->trust_verified_at?->format('d M Y · H:i'),
                'state'                     => $state,
            ],
            'banks' => [
                'ABSA Bank',
                'Capitec Bank',
                'Discovery Bank',
                'First National Bank (FNB)',
                'Investec',
                'Nedbank',
                'Standard Bank',
                'TymeBank',
                'African Bank',
                'Bidvest Bank',
            ],
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $agency = $this->resolveAgency($request);

        $data = $request->validate([
            'trust_bank'                    => ['required', 'string', 'max:120'],
            'trust_account_holder'          => ['required', 'string', 'max:160'],
            'trust_account_number'          => ['required', 'string', 'max:32'],
            'trust_branch_code'             => ['required', 'string', 'max:12'],
            'trust_account_type'            => ['required', 'in:cheque,current,savings'],
            'trust_auditor_name'            => ['required', 'string', 'max:160'],
            'trust_auditor_practice_number' => ['required', 'string', 'max:60'],
        ]);

        // Any change to the bank details invalidates a prior verification —
        // the PPRA expects re-audit when the trust account itself changes.
        $bankFieldsChanged = $agency->trust_bank !== $data['trust_bank']
            || $agency->trust_account_number !== $data['trust_account_number']
            || $agency->trust_branch_code !== $data['trust_branch_code']
            || $agency->trust_account_holder !== $data['trust_account_holder'];

        $agency->fill($data);
        if ($bankFieldsChanged) {
            $agency->trust_verified_at = null;
        }
        $agency->save();

        return redirect()
            ->route('agency.trust-account.show')
            ->with('success', 'Trust account details saved.');
    }
}
