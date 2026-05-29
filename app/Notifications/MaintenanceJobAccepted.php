<?php

namespace App\Notifications;

use App\Models\MaintenanceRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to the tenant when a contractor has started work on their request.
 */
class MaintenanceJobAccepted extends Notification
{
    use Queueable;

    public function __construct(public MaintenanceRequest $request) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $req = $this->request->loadMissing(['contractor']);
        $contractor = $req->contractor?->name ?? 'A contractor';

        return (new MailMessage)
            ->subject("Work started: {$req->title}")
            ->greeting('Hi ' . $notifiable->name . ',')
            ->line("**{$contractor}** has started work on your maintenance request:")
            ->line("**{$req->title}**")
            ->line('You\'ll be notified again when the job is marked complete.')
            ->line('If you need to message the contractor directly, you can do so from the platform.')
            ->action('View request', url('/tenant/maintenance'))
            ->salutation('— Property Basket');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'request_id' => $this->request->id,
            'title'      => $this->request->title,
            'contractor' => $this->request->contractor?->name,
        ];
    }
}
