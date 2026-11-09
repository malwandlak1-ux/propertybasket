<?php

namespace App\Notifications;

use App\Models\BankLink;
use App\Support\Edition;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * The agency's request to its bank for a host-to-host agreement, sent on the
 * agency's behalf. Goes to the banker (agency contact copied, replies go to the
 * contact). With no banker email it goes to the contact instead, to forward.
 */
class BankLinkBankerRequest extends Notification
{
    use Queueable;

    /** Our outbound IP — the bank may need to allow it on its SFTP server. */
    public const SERVER_IP = '46.202.156.98';

    public function __construct(public BankLink $link, public bool $toBanker = true) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $l = $this->link->loadMissing('agency');
        $a = $l->agency;
        $bank = $l->bankName();
        $provider = Edition::brand()['name'];
        $tech = config('mail.from.address');
        $contact = collect([$l->contact_name, $l->contact_email, $l->contact_phone])->filter()->implode(' · ');

        $m = (new MailMessage)
            ->subject("Host-to-host payments on our trust account: request to set up ({$a?->name})")
            ->replyTo($l->contact_email, $l->contact_name);

        if ($this->toBanker) {
            $m->cc($l->contact_email, $l->contact_name)
                ->greeting('Dear ' . ($l->banker_name ?: 'Sir/Madam') . ',');
        } else {
            $m->greeting('Hi ' . $l->contact_name . ',')
                ->line("You didn't give us your {$bank} banker's email, so here is your request to forward to them. Everything below the line is written for the banker.")
                ->line('---');
        }

        $m->line("**{$a?->name}** would like to set up a host-to-host payment link on its trust account, so that agent commission payments can be submitted to {$bank} directly from our property management platform, {$provider}.")
            ->line('**Account**')
            ->line('Account holder: ' . ($a?->trust_account_holder ?: $a?->name))
            ->line('Account number: ' . ($a?->trust_account_number ?: 'to be confirmed'))
            ->line('Account type: Trust account (Section 54, Property Practitioners Act)')
            ->line('**What we need**')
            ->line("1. {$bank} Integration Channel, host-to-host over SFTP, for domestic EFT credit transfers from the trust account.")
            ->line('2. ISO 20022 payment instructions (pain.001.001.03), with status reports (pain.002) returned to us. Please share your file specification, or tell us if you prefer another format or version.')
            ->line("3. Payments submitted through the link should wait for release by our authorised signatories in {$bank} online banking, under our existing dual-authorisation rules.")
            ->line("4. Please record **{$provider}** as our technical service provider for this link. {$provider} will generate and upload the payment files on our behalf; we keep full control of authorising and releasing payments.")
            ->line('**Please let us know**')
            ->line('- The agreement and mandates we need to sign, and any once-off or monthly fees.')
            ->line('- SFTP host, port, username and folder paths, and how SSH keys are exchanged. The platform connects from IP address **' . self::SERVER_IP . '**, if that needs to be allowed on your side.')
            ->line("- Whether files must be PGP-encrypted or signed, and if so, {$bank}'s public key.")
            ->line('- Any client or initiator code to include in the payment files.')
            ->line('- Access to the test (UAT) environment, and the test-and-sign-off process before go-live.')
            ->line('- Cut-off times, payment limits, and the expected timeline to go live.')
            ->line("Please copy {$provider}'s technical team" . ($tech ? " ({$tech})" : '') . ' on technical correspondence, so connection details can go straight to them. Please do not send passwords or private keys by plain email.')
            ->line("Our contact for this request: {$contact}");

        return $m->salutation("Kind regards,\n\n{$l->contact_name}  \n{$a?->name}");
    }
}
