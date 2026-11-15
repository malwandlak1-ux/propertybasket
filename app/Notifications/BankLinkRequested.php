<?php

namespace App\Notifications;

use App\Models\BankLink;
use App\Support\Edition;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** An agency asked for a direct (host-to-host) bank link: a platform admin starts onboarding. */
class BankLinkRequested extends Notification
{
    use Queueable;

    public function __construct(public BankLink $link) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $l = $this->link->loadMissing('agency');

        return (new MailMessage)
            ->subject("Direct {$l->bankName()} link requested: {$l->agency?->name}")
            ->greeting('Hi ' . $notifiable->name . ',')
            ->line("**{$l->agency?->name}** wants to pay commission straight from its {$l->bankName()} trust account (host-to-host).")
            ->line('Contact: ' . collect([$l->contact_name, $l->contact_email, $l->contact_phone])->filter()->implode(' · '))
            ->line($l->banker_name ? "Their banker: {$l->banker_name}" . ($l->banker_email ? " ({$l->banker_email})" : '') : 'No banker named yet.')
            ->action('Open bank links', url('/admin/bank-links'))
            ->salutation('— ' . Edition::brand()['name']);
    }

    public function toArray(object $notifiable): array
    {
        return ['bank_link_id' => $this->link->id, 'agency_name' => $this->link->agency?->name, 'bank' => $this->link->bankName()];
    }
}
