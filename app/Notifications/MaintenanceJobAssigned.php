<?php

namespace App\Notifications;

use App\Models\MaintenanceRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to a contractor's user when an agency/agent allocates a maintenance
 * job to them (i.e. requests a quotation).
 */
class MaintenanceJobAssigned extends Notification
{
    use Queueable;

    public function __construct(public MaintenanceRequest $request) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $property = $this->request->property?->title ?? 'a property';

        return (new MailMessage)
            ->subject('Quote requested: ' . $this->request->title)
            ->greeting('Hi ' . $notifiable->name . ',')
            ->line('You\'ve been asked to quote on a maintenance job at "' . $property . '".')
            ->line('Issue: ' . $this->request->title . ' (' . $this->request->category . ' · ' . $this->request->urgency . ')')
            ->line($this->request->preferred_date
                ? 'Preferred visit: ' . $this->request->preferred_date->format('d M Y') . ($this->request->preferred_time_slot ? ' · ' . $this->request->preferred_time_slot : '')
                : 'No preferred visit slot given.')
            ->action('View job & submit quote', url('/contractor/requests'))
            ->line('Submit your quote so the agency can review and approve it.')
            ->salutation('— The Property Basket team');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'maintenance_request_id' => $this->request->id,
            'title'                  => $this->request->title,
            'category'               => $this->request->category,
            'urgency'                => $this->request->urgency,
            'property_title'         => $this->request->property?->title,
        ];
    }
}
