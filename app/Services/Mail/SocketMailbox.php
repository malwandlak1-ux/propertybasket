<?php

namespace App\Services\Mail;

use App\Models\EmailAccount;

/**
 * Minimal POP3 / IMAP client over PHP streams, so TLS certificates are checked
 * with the system CA store (the old c-client imap extension can't).
 *
 * Read-only in practice: POP3 never sends DELE; IMAP uses EXAMINE and
 * BODY.PEEK, so messages stay unread and in place for the user's other apps.
 */
class SocketMailbox implements Mailbox
{
    /** @var resource */
    private $s;

    private int $tag = 0;

    public function __construct(private EmailAccount $account)
    {
        $this->open();
        try {
            $this->account->protocol === 'imap' ? $this->imapLogin() : $this->popLogin();
        } catch (\Throwable $e) {
            $this->close();
            throw $e;
        }
    }

    public function fetchNew(int $limit, callable $known): array
    {
        return $this->account->protocol === 'imap' ? $this->imapFetch($limit, $known) : $this->popFetch($limit, $known);
    }

    public function close(): void
    {
        if (is_resource($this->s ?? null)) {
            try {
                $this->account->protocol === 'imap' ? $this->imap('LOGOUT', false) : $this->write("QUIT\r\n");
            } catch (\Throwable) {
            }
            @fclose($this->s);
        }
    }

    // ── connection ──────────────────────────────────────────────────────

    private function open(): void
    {
        $a = $this->account;
        $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'peer_name' => $a->incoming_host, 'SNI_enabled' => true]]);
        $scheme = $a->incoming_encryption === 'ssl' ? 'ssl' : 'tcp';
        $s = @stream_socket_client("{$scheme}://{$a->incoming_host}:{$a->incoming_port}", $errno, $err, 20, STREAM_CLIENT_CONNECT, $ctx);
        if (! $s) {
            $last = (string) (error_get_last()['message'] ?? $err);
            if (stripos($last, 'certificate') !== false) {
                throw new MailException("The security certificate of {$a->incoming_host} could not be verified. Check the server name.");
            }
            throw new MailException("Couldn't reach {$a->incoming_host} on port {$a->incoming_port}. Check the server, port and security settings.");
        }
        stream_set_timeout($s, 30);
        $this->s = $s;

        $greeting = $this->line();
        if ($a->protocol === 'imap' ? ! str_starts_with($greeting, '* OK') && ! str_starts_with($greeting, '* PREAUTH') : ! str_starts_with($greeting, '+OK')) {
            throw new MailException("{$a->incoming_host} doesn't look like a " . strtoupper($a->protocol) . ' server on that port.');
        }

        if ($a->incoming_encryption === 'tls') {
            if ($a->protocol === 'imap') {
                $this->imap('STARTTLS');
            } else {
                $this->pop('STLS');
            }
            stream_context_set_option($s, 'ssl', 'verify_peer', true);
            stream_context_set_option($s, 'ssl', 'verify_peer_name', true);
            stream_context_set_option($s, 'ssl', 'peer_name', $a->incoming_host);
            if (! @stream_socket_enable_crypto($s, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new MailException("Couldn't start a secure connection with {$a->incoming_host}. Try SSL/TLS on the standard port.");
            }
        }
    }

    private function write(string $data): void
    {
        if (@fwrite($this->s, $data) === false) {
            throw new MailException('The connection to the mail server dropped.');
        }
    }

    private function line(): string
    {
        $l = fgets($this->s, 65536);
        if ($l === false) {
            $meta = stream_get_meta_data($this->s);
            throw new MailException($meta['timed_out'] ?? false ? 'The mail server stopped responding.' : 'The connection to the mail server dropped.');
        }

        return $l;
    }

    private function bytes(int $n): string
    {
        $buf = '';
        while (strlen($buf) < $n) {
            $chunk = fread($this->s, min(65536, $n - strlen($buf)));
            if ($chunk === false || $chunk === '') {
                if (feof($this->s) || (stream_get_meta_data($this->s)['timed_out'] ?? false)) {
                    throw new MailException('The connection to the mail server dropped while downloading.');
                }
                continue;
            }
            $buf .= $chunk;
        }

        return $buf;
    }

    private function authFailed(): MailException
    {
        return new MailException('The mail server rejected the username or password. Gmail, Outlook and Yahoo need an app password, and POP/IMAP switched on in the mailbox settings.');
    }

    // ── POP3 ────────────────────────────────────────────────────────────

    private function pop(string $cmd): string
    {
        $this->write($cmd . "\r\n");
        $l = $this->line();
        if (! str_starts_with($l, '+OK')) {
            throw new MailException('The mail server said: ' . trim(substr($l, 4)));
        }

        return $l;
    }

    /** Multi-line POP3 response body (dot-unstuffed). */
    private function popMulti(string $cmd): string
    {
        $this->pop($cmd);
        $out = '';
        while (true) {
            $l = $this->line();
            if ($l === ".\r\n" || $l === ".\n") {
                break;
            }
            $out .= str_starts_with($l, '..') ? substr($l, 1) : $l;
        }

        return $out;
    }

    private function popLogin(): void
    {
        try {
            $this->pop('USER ' . $this->account->username);
            $this->pop('PASS ' . $this->account->password);
        } catch (MailException) {
            throw $this->authFailed();
        }
    }

    private function popFetch(int $limit, callable $known): array
    {
        $map = [];
        foreach (preg_split('/\r?\n/', trim($this->popMulti('UIDL'))) as $row) {
            if (preg_match('/^(\d+)\s+(\S+)/', $row, $m)) {
                $map[(int) $m[1]] = 'pop:' . md5($m[2]);
            }
        }
        krsort($map); // newest first
        $out = [];
        foreach ($map as $n => $uid) {
            if (count($out) >= $limit) {
                break;
            }
            if (! $known($uid)) {
                $out[$uid] = $this->popMulti("RETR {$n}");
            }
        }

        return $out;
    }

    // ── IMAP ────────────────────────────────────────────────────────────

    /**
     * Send a tagged command; return untagged lines (literals inlined).
     *
     * @return list<string>
     */
    private function imap(string $cmd, bool $strict = true): array
    {
        $tag = 'A' . (++$this->tag);
        $this->write("{$tag} {$cmd}\r\n");
        $lines = [];
        while (true) {
            $l = $this->line();
            // Literal: {n}\r\n then n bytes, then the rest of the line.
            while (preg_match('/\{(\d+)\}\r?\n$/', $l, $m)) {
                $l .= $this->bytes((int) $m[1]) . $this->line();
            }
            if (str_starts_with($l, $tag . ' ')) {
                if ($strict && ! str_starts_with(substr($l, strlen($tag) + 1), 'OK')) {
                    throw new MailException('The mail server said: ' . trim(substr($l, strlen($tag) + 4)));
                }

                return $lines;
            }
            $lines[] = $l;
        }
    }

    private function quote(string $s): string
    {
        return '"' . str_replace(['\\', '"'], ['\\\\', '\\"'], $s) . '"';
    }

    private function imapLogin(): void
    {
        try {
            $this->imap('LOGIN ' . $this->quote($this->account->username) . ' ' . $this->quote($this->account->password));
        } catch (MailException) {
            throw $this->authFailed();
        }
        $this->imap('EXAMINE INBOX'); // read-only select
    }

    private function imapFetch(int $limit, callable $known): array
    {
        $uids = [];
        foreach ($this->imap('UID SEARCH ALL') as $l) {
            if (str_starts_with($l, '* SEARCH')) {
                $uids = array_merge($uids, array_map('intval', preg_split('/\s+/', trim(substr($l, 8)), -1, PREG_SPLIT_NO_EMPTY)));
            }
        }
        rsort($uids);
        $out = [];
        foreach ($uids as $u) {
            if (count($out) >= $limit) {
                break;
            }
            $key = 'imap:' . $u;
            if ($known($key)) {
                continue;
            }
            $this->write('A' . (++$this->tag) . " UID FETCH {$u} BODY.PEEK[]\r\n");
            $tag = 'A' . $this->tag;
            $raw = null;
            while (true) {
                $l = $this->line();
                if (preg_match('/BODY\[\] \{(\d+)\}\r?\n$/', $l, $m)) {
                    $raw = $this->bytes((int) $m[1]);
                    $this->line(); // closing ")"
                    continue;
                }
                if (str_starts_with($l, $tag . ' ')) {
                    break;
                }
            }
            if ($raw !== null) {
                $out[$key] = $raw;
            }
        }

        return $out;
    }
}
