<?php

namespace App\Services\Banking;

use App\Models\InvestecConnection;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Investec Private Bank API (programmable banking).
 *
 *   token          POST /identity/v2/oauth2/token   (Basic client_id:secret + x-api-key, client_credentials)
 *   accounts       GET  /za/pb/v1/accounts
 *   beneficiaries  GET  /za/pb/v1/accounts/beneficiaries
 *   pay            POST /za/pb/v1/accounts/{accountId}/paymultiple   (max 50 per request)
 *
 * Payments only go to beneficiaries already saved (and paid once) in Investec Online.
 */
class InvestecClient
{
    public const SCOPES = 'accounts beneficiarypayments';
    public const MAX_PER_REQUEST = 50;

    /** Credentials not yet saved (connect form) or a saved connection. */
    public function __construct(
        private string $baseUrl,
        private string $clientId,
        private string $clientSecret,
        private string $apiKey,
    ) {}

    public static function for(InvestecConnection $c): self
    {
        return new self($c->baseUrl(), (string) $c->client_id, (string) $c->client_secret, (string) $c->api_key);
    }

    /** @return array<int, array{accountId:string, accountNumber:string, accountName:?string, productName:?string}> */
    public function accounts(): array
    {
        return (array) ($this->get('/za/pb/v1/accounts')->json('data.accounts') ?? []);
    }

    /** @return array<int, array<string, mixed>> beneficiaryId, accountNumber, code, bank, beneficiaryName, … */
    public function beneficiaries(): array
    {
        return (array) ($this->get('/za/pb/v1/accounts/beneficiaries')->json('data') ?? []);
    }

    /**
     * Pay saved beneficiaries from $accountId. $payments: [beneficiaryId, amount (rand), myReference, theirReference].
     * Returns Investec's TransferResponses in request order.
     *
     * @param  array<int, array{beneficiaryId:string, amount:float, myReference:string, theirReference:string}>  $payments
     */
    public function payMultiple(string $accountId, array $payments): array
    {
        if (count($payments) > self::MAX_PER_REQUEST) {
            throw new InvestecException('Investec takes at most ' . self::MAX_PER_REQUEST . ' payments per request.');
        }
        $res = $this->request()->post("/za/pb/v1/accounts/{$accountId}/paymultiple", [
            'paymentList' => array_map(fn ($p) => [
                'beneficiaryId'  => (string) $p['beneficiaryId'],
                'amount'         => number_format((float) $p['amount'], 2, '.', ''),
                'myReference'    => $p['myReference'],
                'theirReference' => $p['theirReference'],
            ], $payments),
        ]);
        $this->assertOk($res, 'payment');
        if ($err = $res->json('data.ErrorMessage')) {
            throw new InvestecException('Investec refused the payment: ' . $err);
        }

        return (array) ($res->json('data.TransferResponses') ?? []);
    }

    // ── plumbing ─────────────────────────────────────────────────────────

    private function token(): string
    {
        $key = 'investec-token:' . sha1($this->baseUrl . '|' . $this->clientId . '|' . $this->apiKey);

        return Cache::remember($key, now()->addMinutes(25), function () { // tokens last ~30 min
            try {
                $res = Http::baseUrl($this->baseUrl)->timeout(20)->acceptJson()
                    ->withBasicAuth($this->clientId, $this->clientSecret)
                    ->withHeaders(['x-api-key' => $this->apiKey])
                    ->asForm()
                    ->post('/identity/v2/oauth2/token', ['grant_type' => 'client_credentials', 'scope' => self::SCOPES]);
            } catch (ConnectionException $e) {
                throw new InvestecException('Couldn’t reach Investec. Try again in a minute.', previous: $e);
            }
            if ($res->status() === 401 || $res->status() === 400 || $res->status() === 403) {
                throw new InvestecException('Investec didn’t accept these API credentials. Check the client ID, secret and API key in Investec Online → Programmable Banking.');
            }
            $this->assertOk($res, 'login');
            $token = (string) $res->json('access_token');
            if ($token === '') {
                throw new InvestecException('Investec did not return an access token.');
            }

            return $token;
        });
    }

    private function request()
    {
        return Http::baseUrl($this->baseUrl)->timeout(45)->acceptJson()->asJson()->withToken($this->token());
    }

    private function get(string $path): Response
    {
        try {
            $res = $this->request()->get($path);
        } catch (ConnectionException $e) {
            throw new InvestecException('Couldn’t reach Investec. Try again in a minute.', previous: $e);
        }
        $this->assertOk($res, 'request');

        return $res;
    }

    private function assertOk(Response $res, string $what): void
    {
        if ($res->successful()) {
            return;
        }
        $msg = $res->json('data.ErrorMessage') ?? $res->json('error_description') ?? $res->json('message') ?? $res->json('error') ?? null;
        if ($res->status() === 403) {
            throw new InvestecException('Investec refused the ' . $what . ': this API key doesn’t have permission for it. Enable “beneficiary payments” on the key in Investec Online.');
        }
        throw new InvestecException('Investec ' . $what . ' failed (HTTP ' . $res->status() . ')' . ($msg ? ': ' . (is_string($msg) ? $msg : json_encode($msg)) : '.'));
    }
}
