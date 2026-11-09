<?php

namespace App\Notifications;

use App\Models\BankLink;
use App\Support\Edition;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** The agency's direct bank link moved to a new onboarding stage. */
class BankLinkStatusChanged extends Notification
{
    use Queueable;

    public const LABELS = [
        'requested'   => 'Request received',
        'agreement'   => 'Bank agreement in progress',
        'credentials' => 'Connection being set up',
        'testing'     => 'Testing with the bank',
        'live'        => 'Live',
        'paused'      => 'Paused',
    ];

    public function __construct(public BankLink $link) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $stage = self::LABELS[$this->link->status] ?? $this->link->status;

        return (new MailMessage)
            ->subject("Your {$this->link->bankName()} bank link: {$stage}")
            ->greeting('Hi ' . $notifiable->name . ',')
            ->line("Your direct {$this->link->bankName()} link is now at: **{$stage}**.")
            ->line($this->link->status === 'live'
                ? 'You can now choose the ' . $this->link->bankName() . ' direct payout method under Settings → Payouts and pay commission with one click.'
                : 'We will let you know when it moves to the next stage.')
            ->action('View payout settings', url('/agency/settings'))
            ->salutation('— ' . Edition::brand()['name']);
    }

    public function toArray(object $notifiable): array
    {
        return ['bank_link_id' => $this->link->id, 'bank' => $this->link->bankName(), 'status' => $this->link->status];
    }
}
