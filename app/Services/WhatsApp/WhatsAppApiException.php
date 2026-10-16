<?php

namespace App\Services\WhatsApp;

use RuntimeException;

class WhatsAppApiException extends RuntimeException
{
    /** Account-level problems: stop the whole campaign until the agent acts. */
    private const PAUSE = [
        0      => 'Could not reach WhatsApp.',
        4      => 'Meta rate limit reached — sending will resume later.',
        190    => 'Your WhatsApp access token has expired or was revoked. Update it under CRM → WhatsApp.',
        200    => 'The access token is missing a WhatsApp permission.',
        10     => 'The access token is missing a WhatsApp permission.',
        131031 => 'Meta has locked this WhatsApp account. Check WhatsApp Manager.',
        131042 => 'Meta could not charge your WhatsApp account. Top up or fix the payment method in WhatsApp Manager, then resume.',
        131048 => 'Meta flagged too many messages as spam and limited this number. Wait before resuming.',
        130429 => 'Sending too fast for Meta — will resume shortly.',
        131056 => 'Too many messages to the same number — will resume shortly.',
        132001 => 'The template no longer exists or isn’t approved for this language.',
        132015 => 'Meta paused this template because of low quality.',
        132016 => 'Meta disabled this template because of low quality.',
        368    => 'Meta temporarily blocked this account for policy violations.',
    ];

    public function __construct(string $message, public readonly int $metaCode, public readonly ?int $subcode = null)
    {
        parent::__construct($message, $metaCode);
    }

    /** Temporary: stop this run, leave the message queued, try again next run. */
    private const TRANSIENT = [0, 4, 130429, 131056];

    public function isTransient(): bool
    {
        return in_array($this->metaCode, self::TRANSIENT, true);
    }

    /** True when retrying other recipients would fail the same way. */
    public function pausesCampaign(): bool
    {
        return ! $this->isTransient() && array_key_exists($this->metaCode, self::PAUSE);
    }

    public function friendly(): string
    {
        return self::PAUSE[$this->metaCode] ?? $this->getMessage();
    }
}
