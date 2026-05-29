<?php

namespace App\Notifications;

use App\Models\Agency;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class AgencyFfcExpiring extends Notification
{
    use Queueable;

    public function __construct(private readonly Agency $agency, private readonly int $daysLeft) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $expires = $this->agency->eaab_ffc_expires_at?->format('d F Y');
        return (new MailMessage)
            ->subject("Your agency FFC expires in {$this->daysLeft} day" . ($this->daysLeft === 1 ? '' : 's'))
            ->greeting('Hi ' . $notifiable->name . ',')
            ->line("**{$this->agency->name}**'s Fidelity Fund Certificate ({$this->agency->eaab_ffc_number}) expires on **{$expires}** — {$this->daysLeft} day" . ($this->daysLeft === 1 ? '' : 's') . ' from today.')
            ->line('Without a valid agency FFC, no agent on your team can create or update listings on Property Basket. Renew with the PPRA and upload the new certificate before it lapses.')
            ->action('Update agency FFC', url('/agency/compliance'))
            ->line('Section 47 of the Property Practitioners Act prohibits practitioners from acting without a current FFC at the firm level.');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'agency_id'  => $this->agency->id,
            'ffc_number' => $this->agency->eaab_ffc_number,
            'expires_at' => $this->agency->eaab_ffc_expires_at?->toDateString(),
            'days_left'  => $this->daysLeft,
        ];
    }
}
