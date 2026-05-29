<?php

namespace App\Notifications;

use App\Models\MaintenanceRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to both the tenant and the landlord/agency when a contractor marks a job complete.
 * The body adapts to the recipient.
 */
class MaintenanceJobCompleted extends Notification
{
    use Queueable;

    public function __construct(public MaintenanceRequest $request) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $req = $this->request->loadMissing(['contractor', 'property']);
        $contractor = $req->contractor?->name ?? 'The contractor';
        $isTenant = $notifiable->role?->value === 'tenant';

        $msg = (new MailMessage)
            ->subject("Job completed: {$req->title}")
            ->greeting('Hi ' . $notifiable->name . ',');

        if ($isTenant) {
            $msg
                ->line("**{$contractor}** has marked the following job as complete:")
                ->line("**{$req->title}** at {$req->property?->suburb}")
                ->line('If everything is in order, no further action is required. If you have concerns, please flag them within 48 hours via the platform.')
                ->action('Review job', url('/tenant/maintenance'));
        } else {
            $msg
                ->line("**{$contractor}** has completed the job:")
                ->line("**{$req->title}** at {$req->property?->suburb}")
                ->line('The contractor will submit their invoice next. You\'ll receive a separate notification when approval is required.')
                ->action('Review job', url('/landlord/maintenance'));
        }

        return $msg->salutation('— Property Basket');
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
