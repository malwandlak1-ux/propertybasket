<?php

namespace App\Services\Mail;

use Illuminate\Support\Carbon;

/**
 * Small RFC 822 / MIME parser: headers, multipart bodies, base64 and
 * quoted-printable, charsets, encoded-word headers. Attachments are listed by
 * name only — their content is not kept.
 */
class MimeParser
{
    /**
     * @return array{message_id: ?string, in_reply_to: ?string, from_email: ?string, from_name: ?string,
     *   to: list<array{email: string, name: ?string}>, cc: list<array{email: string, name: ?string}>,
     *   subject: string, date: ?Carbon, text: ?string, html: ?string, attachments: list<array{name: string, size: int}>}
     */
    public function parse(string $raw): array
    {
        [$headers, $body] = $this->split($raw);
        $out = ['text' => null, 'html' => null, 'attachments' => []];
        $this->walk($headers, $body, $out);

        $from = $this->addresses($headers['from'] ?? '')[0] ?? null;
        $date = null;
        if (! empty($headers['date'])) {
            try {
                $date = Carbon::parse(preg_replace('/\s*\([^)]*\)\s*$/', '', $headers['date']));
            } catch (\Throwable) {
                $date = null;
            }
        }
        $text = $out['text'];
        if ($text === null && $out['html'] !== null) {
            $text = $this->htmlToText($out['html']);
        }

        return [
            'message_id' => $this->angle($headers['message-id'] ?? null),
            'in_reply_to' => $this->angle($headers['in-reply-to'] ?? null),
            'from_email' => $from['email'] ?? null,
            'from_name' => $from['name'] ?? null,
            'to' => $this->addresses($headers['to'] ?? ''),
            'cc' => $this->addresses($headers['cc'] ?? ''),
            'subject' => $this->decodeHeader($headers['subject'] ?? ''),
            'date' => $date,
            'text' => $text !== null ? trim($text) : null,
            'html' => $out['html'],
            'attachments' => $out['attachments'],
        ];
    }

    /** @return array{0: array<string, string>, 1: string} lower-cased headers (unfolded) and body */
    public function split(string $raw): array
    {
        $raw = str_replace("\r\n", "\n", $raw);
        $pos = strpos($raw, "\n\n");
        $head = $pos === false ? $raw : substr($raw, 0, $pos);
        $body = $pos === false ? '' : substr($raw, $pos + 2);
        $head = preg_replace("/\n[ \t]+/", ' ', $head);
        $headers = [];
        foreach (explode("\n", $head) as $line) {
            if (! str_contains($line, ':')) {
                continue;
            }
            [$k, $v] = explode(':', $line, 2);
            $k = strtolower(trim($k));
            if (! isset($headers[$k])) { // first occurrence wins (Received etc. repeat)
                $headers[$k] = trim($v);
            }
        }

        return [$headers, $body];
    }

    private function walk(array $headers, string $body, array &$out, int $depth = 0): void
    {
        if ($depth > 10) {
            return;
        }
        [$type, $params] = $this->contentType($headers['content-type'] ?? 'text/plain');
        $disposition = strtolower($headers['content-disposition'] ?? '');
        $filename = $this->param($headers['content-disposition'] ?? '', 'filename') ?? ($params['name'] ?? null);

        if (str_starts_with($type, 'multipart/') && ! empty($params['boundary'])) {
            foreach ($this->parts($body, $params['boundary']) as $part) {
                [$h, $b] = $this->split($part);
                $this->walk($h, $b, $out, $depth + 1);
            }

            return;
        }
        if ($type === 'message/rfc822') {
            $out['attachments'][] = ['name' => 'forwarded-message.eml', 'size' => strlen($body)];

            return;
        }

        $decoded = $this->decodeBody($body, $headers['content-transfer-encoding'] ?? '');
        $isAttachment = str_starts_with($disposition, 'attachment') || ($filename && ! in_array($type, ['text/plain', 'text/html'], true));
        if ($isAttachment) {
            $out['attachments'][] = ['name' => $this->decodeHeader($filename ?? 'attachment'), 'size' => strlen($decoded)];

            return;
        }
        if ($type === 'text/plain' && $out['text'] === null) {
            $out['text'] = $this->toUtf8($decoded, $params['charset'] ?? null);
        } elseif ($type === 'text/html' && $out['html'] === null) {
            $out['html'] = $this->toUtf8($decoded, $params['charset'] ?? null);
        }
    }

    /** @return list<string> */
    private function parts(string $body, string $boundary): array
    {
        $chunks = preg_split('/^--' . preg_quote($boundary, '/') . '(?:--)?[ \t]*$/m', $body);
        if (! $chunks || count($chunks) < 2) {
            return [];
        }
        array_shift($chunks); // preamble
        $parts = [];
        foreach ($chunks as $c) {
            $c = preg_replace('/^\n/', '', $c);
            if (trim($c) !== '') {
                $parts[] = $c;
            }
        }

        return $parts;
    }

    /** @return array{0: string, 1: array<string, string>} */
    private function contentType(string $value): array
    {
        $bits = explode(';', $value);
        $type = strtolower(trim(array_shift($bits)));
        $params = [];
        foreach ($bits as $b) {
            if (str_contains($b, '=')) {
                [$k, $v] = explode('=', $b, 2);
                $params[strtolower(trim($k))] = trim(trim($v), '"');
            }
        }

        return [$type ?: 'text/plain', $params];
    }

    private function param(string $header, string $name): ?string
    {
        if (preg_match('/' . $name . '\*=(?:[^\']*\'[^\']*\')?"?([^";]+)"?/i', $header, $m)) {
            return rawurldecode($m[1]);
        }
        if (preg_match('/' . $name . '="?([^";]+)"?/i', $header, $m)) {
            return $m[1];
        }

        return null;
    }

    private function decodeBody(string $body, string $encoding): string
    {
        return match (strtolower(trim($encoding))) {
            'base64' => (string) base64_decode(preg_replace('/\s+/', '', $body)),
            'quoted-printable' => quoted_printable_decode($body),
            default => $body,
        };
    }

    private function toUtf8(string $s, ?string $charset): string
    {
        $charset = strtoupper(trim((string) $charset));
        if ($charset !== '' && $charset !== 'UTF-8' && $charset !== 'US-ASCII') {
            $conv = @mb_convert_encoding($s, 'UTF-8', $charset === 'WINDOWS-1252' ? 'Windows-1252' : $charset);
            if ($conv !== false) {
                $s = $conv;
            }
        }

        return mb_check_encoding($s, 'UTF-8') ? $s : mb_convert_encoding($s, 'UTF-8', 'ISO-8859-1');
    }

    public function decodeHeader(string $value): string
    {
        if (! str_contains($value, '=?')) {
            return trim($value);
        }
        $value = preg_replace('/\?=\s+=\?/', '?==?', $value); // adjacent encoded words join without space
        $out = preg_replace_callback('/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/', function ($m) {
            $bytes = strtoupper($m[2]) === 'B'
                ? base64_decode($m[3])
                : quoted_printable_decode(str_replace('_', ' ', $m[3]));

            return $this->toUtf8((string) $bytes, $m[1]);
        }, $value);

        return trim((string) $out);
    }

    /** @return list<array{email: string, name: ?string}> */
    public function addresses(string $value): array
    {
        $list = [];
        // Split on commas that are not inside quotes or angle brackets.
        foreach (preg_split('/,(?=(?:[^"]*"[^"]*")*[^"]*$)(?![^<]*>)/', $value) ?: [] as $one) {
            $one = trim($one);
            if ($one === '') {
                continue;
            }
            if (preg_match('/^(.*)<([^>]+)>$/', $one, $m)) {
                $name = trim($this->decodeHeader(trim($m[1])), " \"'");
                $email = trim($m[2]);
            } else {
                $name = null;
                $email = trim($one, ' <>');
            }
            if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $list[] = ['email' => strtolower($email), 'name' => $name ?: null];
            }
        }

        return $list;
    }

    private function angle(?string $v): ?string
    {
        if (! $v) {
            return null;
        }
        if (preg_match('/<([^>]+)>/', $v, $m)) {
            return substr($m[1], 0, 250);
        }

        return substr(trim($v), 0, 250) ?: null;
    }

    public function htmlToText(string $html): string
    {
        $html = preg_replace('#<(script|style|head)[^>]*>.*?</\1>#is', '', $html);
        $html = preg_replace('#<br\s*/?>|</(p|div|tr|li|h[1-6])>#i', "\n", $html);
        $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');

        return trim(preg_replace("/\n{3,}/", "\n\n", preg_replace('/[ \t]+/', ' ', $text)));
    }
}
