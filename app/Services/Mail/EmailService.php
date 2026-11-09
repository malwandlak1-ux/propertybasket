<?php

namespace App\Services\Mail;

use App\Models\EmailAccount;
use App\Models\EmailMessage;
use Illuminate\Support\Str;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Symfony\Component\Mailer\Transport\Smtp\EsmtpTransport;
use Symfony\Component\Mailer\Transport\TransportInterface;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;

/**
 * Connect, sync and send for a user's own mailbox. The network edges —
 * openMailbox(), checkSmtp() and transport() — are the seams tests replace.
 */
class EmailService
{
    /** Messages pulled per sync (newest first). */
    public const BATCH = 50;

    public function __construct(private MimeParser $parser) {}

    public function openMailbox(EmailAccount $account): Mailbox
    {
        return new ImapMailbox($account);
    }

    public function transport(EmailAccount $account): TransportInterface
    {
        return $this->smtp($account);
    }

    protected function smtp(EmailAccount $account): EsmtpTransport
    {
        $t = new EsmtpTransport($account->smtp_host, $account->smtp_port, $account->smtp_encryption === 'ssl');
        if ($account->smtp_encryption === 'none') {
            $t->setAutoTls(false);
        }
        $t->setUsername($account->smtpUser());
        $t->setPassword($account->smtpPass());

        return $t;
    }

    /** Log in to both servers; throws MailException with a readable reason. */
    public function check(EmailAccount $account): void
    {
        $box = $this->openMailbox($account);
        $box->close();
        $this->checkSmtp($account);
    }

    public function checkSmtp(EmailAccount $account): void
    {
        $t = $this->smtp($account);
        try {
            $t->start();
            $t->stop();
        } catch (TransportExceptionInterface $e) {
            throw new MailException($this->smtpReason($e->getMessage(), $account));
        }
    }

    /** Pull new messages into the inbox. Returns how many were stored. */
    public function sync(EmailAccount $account): int
    {
        try {
            $box = $this->openMailbox($account);
            try {
                $known = fn (string $uid) => EmailMessage::where('email_account_id', $account->id)->where('folder', 'inbox')->where('uid', $uid)->exists();
                $raw = $box->fetchNew(self::BATCH, $known);
            } finally {
                $box->close();
            }
        } catch (MailException $e) {
            $account->update(['last_error' => Str::limit($e->getMessage(), 490)]);
            throw $e;
        }

        $stored = 0;
        foreach ($raw as $uid => $message) {
            $p = $this->parser->parse($message);
            EmailMessage::firstOrCreate(
                ['email_account_id' => $account->id, 'folder' => 'inbox', 'uid' => $uid],
                [
                    'message_id' => $p['message_id'],
                    'in_reply_to' => $p['in_reply_to'],
                    'from_email' => $p['from_email'],
                    'from_name' => $p['from_name'] ? Str::limit($p['from_name'], 250, '') : null,
                    'to' => $p['to'],
                    'cc' => $p['cc'],
                    'subject' => Str::limit($p['subject'], 490, '…'),
                    'body_text' => $p['text'],
                    'body_html' => $p['html'],
                    'attachments' => $p['attachments'] ?: null,
                    'received_at' => $p['date'] ?? now(),
                ],
            );
            $stored++;
        }
        $account->update(['last_synced_at' => now(), 'last_error' => null]);

        return $stored;
    }

    /**
     * Send from the user's mailbox and keep a copy under Sent.
     *
     * @param  list<string>  $to
     * @param  list<string>  $cc
     */
    public function send(EmailAccount $account, array $to, array $cc, string $subject, string $body, ?EmailMessage $replyTo = null): EmailMessage
    {
        $from = new Address($account->email, (string) $account->display_name);
        $email = (new Email)->from($from)->to(...$to)->subject($subject)->text($body);
        if ($cc) {
            $email->cc(...$cc);
        }
        if ($replyTo?->message_id) {
            $email->getHeaders()->addIdHeader('In-Reply-To', $replyTo->message_id);
            $email->getHeaders()->addIdHeader('References', $replyTo->message_id);
        }

        try {
            $sent = $this->transport($account)->send($email);
        } catch (TransportExceptionInterface $e) {
            throw new MailException($this->smtpReason($e->getMessage(), $account));
        }
        $messageId = $sent?->getMessageId();

        return EmailMessage::create([
            'email_account_id' => $account->id,
            'folder' => 'sent',
            'uid' => 'sent:' . Str::uuid(),
            'message_id' => $messageId,
            'in_reply_to' => $replyTo?->message_id,
            'from_email' => $account->email,
            'from_name' => $account->display_name,
            'to' => array_map(fn ($e) => ['email' => $e, 'name' => null], $to),
            'cc' => array_map(fn ($e) => ['email' => $e, 'name' => null], $cc),
            'subject' => $subject,
            'body_text' => $body,
            'received_at' => now(),
            'read_at' => now(),
        ]);
    }

    private function smtpReason(string $msg, EmailAccount $a): string
    {
        $m = strtolower($msg);
        if (str_contains($m, '535') || str_contains($m, 'authenticat') || str_contains($m, 'credentials')) {
            return 'The outgoing (SMTP) server rejected the username or password. Some providers need an app password.';
        }
        if (str_contains($m, 'connection') || str_contains($m, 'timed out') || str_contains($m, 'refused')) {
            return "Couldn't reach the outgoing server {$a->smtp_host} on port {$a->smtp_port}. Check the server, port and security settings.";
        }

        return 'The outgoing server said: ' . Str::limit($msg, 300);
    }
}
