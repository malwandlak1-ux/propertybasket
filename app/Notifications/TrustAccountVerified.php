<?php

namespace App\Notifications;

use App\Models\Agency;
use App\Support\Edition;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** The platform verified an agency's trust account. */
class TrustAccountVerified extends Notification
{
    use Queueable;

    public function __construct(public Agency $agency) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Your trust account is verified')
            ->greeting('Hi ' . $notifiable->name . ',')
            ->line("The trust account for **{$this->agency->name}** ({$this->agency->trust_bank}) has been verified by the platform.")
            ->line('If you change the bank details later, the account goes back for re-verification.')
            ->action('View trust account', url('/agency/trust-account'))
            ->salutation('— ' . Edition::brand()['name']);
    }

    public function toArray(object $notifiable): array
    {
        return [
            'agency_id'   => $this->agency->id,
            'agency_name' => $this->agency->name,
            'bank'        => $this->agency->trust_bank,
        ];
    }
}
