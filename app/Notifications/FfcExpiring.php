<?php

namespace App\Notifications;

use App\Models\AgencyAgent;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class FfcExpiring extends Notification
{
    use Queueable;

    public function __construct(private readonly AgencyAgent $pivot, private readonly int $daysLeft) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $expires = $this->pivot->ffc_expires_at?->format('d F Y');
        $msg = (new MailMessage)
            ->subject("Your FFC expires in {$this->daysLeft} day" . ($this->daysLeft === 1 ? '' : 's'))
            ->greeting('Hi ' . $notifiable->name . ',')
            ->line("Your Fidelity Fund Certificate ({$this->pivot->ffc_number}) is set to expire on **{$expires}** — {$this->daysLeft} day" . ($this->daysLeft === 1 ? '' : 's') . ' from today.')
            ->line('Renew with the PPRA and upload the new certificate before it lapses to keep transacting on Property Basket.')
            ->action('Update FFC certificate', url('/agent/ffc'))
            ->line('Section 47 of the Property Practitioners Act prevents practitioners from acting without a current FFC.');

        return $msg;
    }

    public function toArray(object $notifiable): array
    {
        return [
            'pivot_id'   => $this->pivot->id,
            'ffc_number' => $this->pivot->ffc_number,
            'expires_at' => $this->pivot->ffc_expires_at?->toDateString(),
            'days_left'  => $this->daysLeft,
        ];
    }
}
