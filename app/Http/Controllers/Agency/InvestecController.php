<?php

namespace App\Http\Controllers\Agency;

use App\Enums\Role;
use App\Http\Controllers\Agency\Concerns\ResolvesAgency;
use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\InvestecConnection;
use App\Models\User;
use App\Services\Banking\InvestecClient;
use App\Services\Banking\InvestecException;
use App\Services\Banking\InvestecPayouts;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/** Link an agency's Investec trust account (Private Bank API) for one-click commission payouts. */
class InvestecController extends Controller
{
    use ResolvesAgency;

    /** POST /agency/payouts/investec — check the API keys and link the trust account. */
    public function connect(Request $request): RedirectResponse
    {
        $agency = $this->adminAgency($request);
        $data = $request->validate([
            'environment'   => ['required', 'in:production,sandbox'],
            'client_id'     => ['required', 'string', 'max:200'],
            'client_secret' => ['required', 'string', 'max:200'],
            'api_key'       => ['required', 'string', 'max:500'],
        ], [], ['client_id' => 'client ID', 'client_secret' => 'client secret', 'api_key' => 'API key']);

        $trust = Agency::digits($agency->trust_account_number);
        if ($trust === '') {
            return back()->with('error', 'Capture your trust account first (Trust Account page), then link it to Investec.');
        }

        $base = $data['environment'] === 'sandbox' ? 'https://openapisandbox.investec.com' : 'https://openapi.investec.com';
        try {
            $accounts = (new InvestecClient($base, trim($data['client_id']), trim($data['client_secret']), trim($data['api_key'])))->accounts();
        } catch (InvestecException $e) {
            return back()->with('error', $e->getMessage());
        }

        $match = collect($accounts)->first(fn ($a) => Agency::digits($a['accountNumber'] ?? '') === $trust);
        if (! $match) {
            $found = collect($accounts)->map(fn ($a) => '•••• ' . substr(Agency::digits($a['accountNumber'] ?? ''), -4))->implode(', ');

            return back()->with('error', 'None of the Investec accounts on these API keys is your trust account (•••• ' . substr($trust, -4) . ').'
                . ($found ? " Found: {$found}." : ' No accounts were returned.') . ' Use the keys of the profile that holds the trust account.');
        }

        InvestecConnection::updateOrCreate(['agency_id' => $agency->id], [
            'environment'     => $data['environment'],
            'client_id'       => trim($data['client_id']),
            'client_secret'   => trim($data['client_secret']),
            'api_key'         => trim($data['api_key']),
            'account_id'      => (string) $match['accountId'],
            'account_number'  => (string) $match['accountNumber'],
            'account_name'    => mb_substr((string) ($match['accountName'] ?? $match['referenceName'] ?? ''), 0, 120) ?: null,
            'connected_at'    => now(),
            'last_checked_at' => now(),
            'last_error'      => null,
        ]);

        return back()->with('success', 'Investec linked: ' . ($match['accountName'] ?? 'trust account') . ' •••• ' . substr($trust, -4)
            . ($data['environment'] === 'sandbox' ? ' (sandbox)' : '') . '. Choose “Investec” as your payout method and save.');
    }

    /** DELETE /agency/payouts/investec */
    public function disconnect(Request $request): RedirectResponse
    {
        $agency = $this->adminAgency($request);
        $agency->investecConnection()->delete();
        if (($agency->payout_method ?? 'paystack') === 'investec') {
            $agency->update(['payout_method' => $agency->trustAccountVerified() ? 'trust_account' : 'paystack']);
        }

        return back()->with('success', 'Investec disconnected. Your API keys have been removed from Property Basket.');
    }

    /** GET /agency/payouts/investec/agents — which agents can be paid (saved as Investec beneficiaries). JSON for the settings check. */
    public function agents(Request $request, InvestecPayouts $payouts): JsonResponse
    {
        $agency = $this->adminAgency($request);
        $c = $agency->investecConnection;
        if (! $c) {
            return response()->json(['error' => 'Investec is not connected.'], 422);
        }
        $agents = User::whereIn('id', $agency->agents()->pluck('users.id'))->get();
        try {
            $rows = $payouts->match($c, $agents);
        } catch (InvestecException $e) {
            $c->update(['last_error' => mb_substr($e->getMessage(), 0, 300), 'last_checked_at' => now()]);

            return response()->json(['error' => $e->getMessage()], 422);
        }
        $c->update(['last_error' => null, 'last_checked_at' => now()]);

        return response()->json(['agents' => $rows]);
    }

    private function adminAgency(Request $request): Agency
    {
        abort_unless(in_array($request->user()->role, [Role::AgencyAdmin, Role::SuperAdmin], true), 403, 'Only an agency admin can manage payouts.');

        return $this->resolveAgency($request);
    }
}
