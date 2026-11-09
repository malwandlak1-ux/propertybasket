<?php

namespace App\Services\Mail;

use App\Models\EmailAccount;

/**
 * POP3 or IMAP through PHP's imap extension. Messages are read with FT_PEEK
 * and never deleted, so the user's other mail apps are unaffected.
 *
 * Uids: IMAP uses the server UID; POP3 has no usable UID through ext-imap, so
 * the uid is a hash of the Message-ID (or the whole header when missing).
 */
class ImapMailbox implements Mailbox
{
    /** @var resource|\IMAP\Connection */
    private $conn;

    public function __construct(private EmailAccount $account)
    {
        if (! function_exists('imap_open')) {
            throw new MailException('Email reading is not available on this server (PHP imap extension missing).');
        }
        imap_timeout(IMAP_OPENTIMEOUT, 20);
        imap_timeout(IMAP_READTIMEOUT, 30);
        // POP3 can't be opened read-only; it is safe anyway as nothing is ever flagged for deletion or expunged.
        $conn = @imap_open(self::mailboxString($account), $account->username, $account->password, $account->protocol === 'imap' ? OP_READONLY : 0, 1);
        if (! $conn) {
            $err = imap_last_error() ?: 'unknown error';
            imap_errors();
            imap_alerts();
            throw new MailException(self::friendly($err, $account));
        }
        $this->conn = $conn;
    }

    public static function mailboxString(EmailAccount $a): string
    {
        $flags = '/' . ($a->protocol === 'imap' ? 'imap' : 'pop3');
        $flags .= match ($a->incoming_encryption) {
            'ssl' => '/ssl',
            'tls' => '/tls',
            default => '/notls',
        };

        return '{' . $a->incoming_host . ':' . $a->incoming_port . $flags . '}INBOX';
    }

    public function fetchNew(int $limit, callable $known): array
    {
        $total = (int) imap_num_msg($this->conn);
        $out = [];
        $scanned = 0;
        for ($n = $total; $n >= 1 && count($out) < $limit && $scanned < $limit * 3; $n--, $scanned++) {
            $header = (string) imap_fetchheader($this->conn, $n, FT_PREFETCHTEXT);
            if ($this->account->protocol === 'imap') {
                $uid = 'imap:' . imap_uid($this->conn, $n);
            } else {
                $uid = preg_match('/^message-id:\s*(.+)$/im', $header, $m)
                    ? 'pop:' . md5(trim($m[1]))
                    : 'pop:' . md5($header);
            }
            if ($known($uid)) {
                continue;
            }
            $out[$uid] = $header . (string) imap_body($this->conn, $n, FT_PEEK);
        }
        imap_errors();

        return $out;
    }

    public function close(): void
    {
        @imap_close($this->conn);
        imap_errors();
        imap_alerts();
    }

    private static function friendly(string $err, EmailAccount $a): string
    {
        $e = strtolower($err);
        if (str_contains($e, 'authentic') || str_contains($e, 'login') || str_contains($e, 'password') || str_contains($e, 'credentials')) {
            return 'The mail server rejected the username or password. Gmail, Outlook and Yahoo need an app password, and POP/IMAP switched on in the mailbox settings.';
        }
        if (str_contains($e, 'certificate')) {
            return 'The mail server’s security certificate could not be verified. Check the server name.';
        }
        if (str_contains($e, 'connect') || str_contains($e, 'host') || str_contains($e, 'timed out') || str_contains($e, 'refused')) {
            return "Couldn't reach {$a->incoming_host} on port {$a->incoming_port}. Check the server, port and security settings.";
        }

        return 'The mail server said: ' . $err;
    }
}
