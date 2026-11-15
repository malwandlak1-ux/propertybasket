<?php

namespace App\Services\Mail;

/** An open incoming mailbox (POP3 or IMAP). */
interface Mailbox
{
    /**
     * The newest messages not yet stored, newest first.
     *
     * @param  callable(string $uid): bool  $known  true when the uid is already stored
     * @return array<string, string>  uid => raw RFC 822 message
     */
    public function fetchNew(int $limit, callable $known): array;

    public function close(): void;
}
