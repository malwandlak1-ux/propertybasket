<?php

namespace App\Services\Banking\H2H;

use Illuminate\Support\Str;

/**
 * ISO 20022 for host-to-host payouts:
 *   pain.001.001.03  CustomerCreditTransferInitiation  (us → bank: pay these people)
 *   pain.002.001.03  CustomerPaymentStatusReport        (bank → us: accepted / settled / rejected)
 *
 * SA domestic EFT: creditor bank identified by branch code under clearing system ZANCC.
 */
class Iso20022
{
    /**
     * @param  array{message_id:string, created_at:\DateTimeInterface, execution_date:\DateTimeInterface, initiator_name:string, initiator_id:?string,
     *               debtor_name:string, debtor_account:string, payment_info_id:string}  $header
     * @param  array<int, array{end_to_end_id:string, amount:float, name:string, account:string, branch_code:string, reference:string}>  $payments
     */
    public function creditTransfer(BankProfile $bank, array $header, array $payments): string
    {
        if ($payments === []) {
            throw new \InvalidArgumentException('A payment file needs at least one payment.');
        }
        $count = (string) count($payments);
        $sum = $this->money(array_sum(array_map(fn ($p) => round($p['amount'], 2), $payments)));

        $doc = new \DOMDocument('1.0', 'UTF-8');
        $doc->formatOutput = true;
        $root = $doc->createElementNS('urn:iso:std:iso:20022:tech:xsd:' . $bank->painVersion, 'Document');
        $doc->appendChild($root);
        $init = $this->add($doc, $root, 'CstmrCdtTrfInitn');

        $grp = $this->add($doc, $init, 'GrpHdr');
        $this->add($doc, $grp, 'MsgId', $this->id($header['message_id']));
        $this->add($doc, $grp, 'CreDtTm', $header['created_at']->format('Y-m-d\TH:i:s'));
        $this->add($doc, $grp, 'NbOfTxs', $count);
        $this->add($doc, $grp, 'CtrlSum', $sum);
        $initg = $this->add($doc, $grp, 'InitgPty');
        $this->add($doc, $initg, 'Nm', $this->text($header['initiator_name'], 70));
        if (filled($header['initiator_id'])) {
            $othr = $this->add($doc, $this->add($doc, $this->add($doc, $initg, 'Id'), 'OrgId'), 'Othr');
            $this->add($doc, $othr, 'Id', $this->text($header['initiator_id'], 35));
        }

        $pmt = $this->add($doc, $init, 'PmtInf');
        $this->add($doc, $pmt, 'PmtInfId', $this->id($header['payment_info_id']));
        $this->add($doc, $pmt, 'PmtMtd', 'TRF');
        $this->add($doc, $pmt, 'BtchBookg', 'true');
        $this->add($doc, $pmt, 'NbOfTxs', $count);
        $this->add($doc, $pmt, 'CtrlSum', $sum);
        $this->add($doc, $this->add($doc, $this->add($doc, $pmt, 'PmtTpInf'), 'SvcLvl'), 'Cd', 'NURG');
        $this->add($doc, $pmt, 'ReqdExctnDt', $header['execution_date']->format('Y-m-d'));
        $this->add($doc, $this->add($doc, $pmt, 'Dbtr'), 'Nm', $this->text($header['debtor_name'], 70));
        $dAcct = $this->add($doc, $pmt, 'DbtrAcct');
        $this->add($doc, $this->add($doc, $this->add($doc, $dAcct, 'Id'), 'Othr'), 'Id', $this->digits($header['debtor_account']));
        $this->add($doc, $dAcct, 'Ccy', 'ZAR');
        $this->add($doc, $this->add($doc, $this->add($doc, $pmt, 'DbtrAgt'), 'FinInstnId'), 'BIC', $bank->bic);
        $this->add($doc, $pmt, 'ChrgBr', 'SLEV');

        foreach ($payments as $p) {
            $tx = $this->add($doc, $pmt, 'CdtTrfTxInf');
            $this->add($doc, $this->add($doc, $tx, 'PmtId'), 'EndToEndId', $this->id($p['end_to_end_id']));
            $amt = $this->add($doc, $this->add($doc, $tx, 'Amt'), 'InstdAmt', $this->money($p['amount']));
            $amt->setAttribute('Ccy', 'ZAR');
            $clr = $this->add($doc, $this->add($doc, $this->add($doc, $tx, 'CdtrAgt'), 'FinInstnId'), 'ClrSysMmbId');
            $this->add($doc, $this->add($doc, $clr, 'ClrSysId'), 'Cd', 'ZANCC');
            $this->add($doc, $clr, 'MmbId', $this->digits($p['branch_code']));
            $this->add($doc, $this->add($doc, $tx, 'Cdtr'), 'Nm', $this->text($p['name'], 70));
            $this->add($doc, $this->add($doc, $this->add($doc, $this->add($doc, $tx, 'CdtrAcct'), 'Id'), 'Othr'), 'Id', $this->digits($p['account']));
            $this->add($doc, $this->add($doc, $tx, 'RmtInf'), 'Ustrd', $this->text($p['reference'], 140));
        }

        return $doc->saveXML();
    }

    /**
     * Read a pain.002 status report.
     *
     * @return array{message_id:?string, group_status:?string, transactions: array<string, array{status:string, reason:?string}>}
     */
    public function statusReport(string $xml): array
    {
        $doc = new \DOMDocument();
        $prev = libxml_use_internal_errors(true);
        $ok = $doc->loadXML($xml, LIBXML_NONET); // no network, no entity expansion (XXE-safe)
        libxml_use_internal_errors($prev);
        if (! $ok) {
            throw new \InvalidArgumentException('Not a readable XML status file.');
        }
        $x = new \DOMXPath($doc);
        $one = fn (string $path, ?\DOMNode $ctx = null) => ($n = $x->query($path, $ctx)?->item(0)) ? trim($n->textContent) : null;

        if (! $x->query("//*[local-name()='CstmrPmtStsRpt']")->length) {
            throw new \InvalidArgumentException('Not a pain.002 payment status report.');
        }

        $txs = [];
        foreach ($x->query("//*[local-name()='TxInfAndSts']") as $tx) {
            $e2e = $one("*[local-name()='OrgnlEndToEndId']", $tx);
            if ($e2e === null) {
                continue;
            }
            $reasonCode = $one(".//*[local-name()='StsRsnInf']/*[local-name()='Rsn']/*", $tx);
            $reasonText = $one(".//*[local-name()='StsRsnInf']/*[local-name()='AddtlInf']", $tx);
            $txs[$e2e] = [
                'status' => (string) $one("*[local-name()='TxSts']", $tx),
                'reason' => trim(implode(' — ', array_filter([$reasonCode, $reasonText]))) ?: null,
            ];
        }

        return [
            'message_id'   => $one("//*[local-name()='OrgnlGrpInfAndSts']/*[local-name()='OrgnlMsgId']"),
            'group_status' => $one("//*[local-name()='OrgnlGrpInfAndSts']/*[local-name()='GrpSts']"),
            'group_reason' => trim(implode(' — ', array_filter([
                $one("//*[local-name()='OrgnlGrpInfAndSts']/*[local-name()='StsRsnInf']/*[local-name()='Rsn']/*"),
                $one("//*[local-name()='OrgnlGrpInfAndSts']/*[local-name()='StsRsnInf']/*[local-name()='AddtlInf']"),
            ]))) ?: null,
            'transactions' => $txs,
        ];
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private function add(\DOMDocument $doc, \DOMElement $parent, string $name, ?string $value = null): \DOMElement
    {
        $el = $doc->createElementNS($parent->namespaceURI ?? $doc->documentElement?->namespaceURI, $name);
        if ($value !== null) {
            $el->appendChild($doc->createTextNode($value));
        }
        $parent->appendChild($el);

        return $el;
    }

    private function money(float $v): string
    {
        return number_format(round($v, 2), 2, '.', '');
    }

    private function digits(string $v): string
    {
        return preg_replace('/\D+/', '', $v);
    }

    /** Bank files accept the SWIFT Latin character set only. */
    private function text(string $v, int $max): string
    {
        $v = preg_replace("/[^A-Za-z0-9\/\-\?:\(\)\.,'\+ ]/", ' ', Str::ascii($v));

        return mb_substr(trim(preg_replace('/\s+/', ' ', $v)), 0, $max);
    }

    private function id(string $v): string
    {
        return mb_substr(preg_replace('/[^A-Za-z0-9\-]/', '', $v), 0, 35);
    }
}
