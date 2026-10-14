<?php

namespace App\Services;

use App\Models\Landlord;
use App\Models\Lease;

/**
 * Where a tenant pays rent by EFT: the managing agency's trust account, or
 * the landlord's own bank account — with the lease's payment reference.
 */
class RentPayee
{
    /**
     * @return array{name: string, holder: string, bank: string, account: string, branch: string, type: ?string, reference: string}|null
     *   null when no bank account has been captured yet
     */
    public function for(Lease $lease): ?array
    {
        $lease->loadMissing(['agency', 'listing', 'tenant']);
        $reference = $this->reference($lease);

        if ($lease->agency) {
            $a = $lease->agency;
            if (! $a->trust_bank || ! $a->trust_account_number || ! $a->trust_branch_code) {
                return null;
            }

            return [
                'name'      => $a->name,
                'holder'    => $a->trust_account_holder ?: $a->name,
                'bank'      => $a->trust_bank,
                'account'   => $a->trust_account_number,
                'branch'    => $a->trust_branch_code,
                'type'      => $a->trust_account_type,
                'reference' => $reference,
            ];
        }

        $landlord = $this->landlord($lease);
        if (! $landlord || ! $landlord->hasBankingDetails()) {
            return null;
        }

        return [
            'name'      => $landlord->user?->name ?? $landlord->bank_account_holder,
            'holder'    => $landlord->bank_account_holder,
            'bank'      => $landlord->bank_name,
            'account'   => $landlord->bank_account_number,
            'branch'    => $landlord->bank_branch_code,
            'type'      => $landlord->bank_account_type,
            'reference' => $reference,
        ];
    }

    /** The lease's payment reference, e.g. "Melissa Parkin Rental". */
    public function reference(Lease $lease): string
    {
        if ($lease->payment_reference) {
            return $lease->payment_reference;
        }
        $name = trim((string) $lease->tenant?->name);

        return $name !== '' ? mb_strimwidth($name . ' Rental', 0, 60) : 'Lease ' . str_pad((string) $lease->id, 6, '0', STR_PAD_LEFT);
    }

    /** The landlord who owns the leased property. */
    public function landlord(Lease $lease): ?Landlord
    {
        if ($lease->listing?->owner_type === Landlord::class) {
            return Landlord::with('user')->find($lease->listing->owner_id);
        }

        return $lease->landlord_id ? Landlord::with('user')->where('user_id', $lease->landlord_id)->first() : null;
    }
}
