<?php

namespace App\Notifications;

use App\Models\MaintenanceRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to the landlord / managing agency when a tenant logs a maintenance request.
 */
class MaintenanceRequestSubmitted extends Notification
{
    use Queueable;

    public function __construct(public MaintenanceRequest $request) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $req = $this->request->loadMissing(['property', 'submitter']);

        $urgencyTone = match ($req->urgency) {
            'emergency' => '🚨 EMERGENCY · 4-hour SLA',
            'high'      => 'High priority',
            'medium'    => 'Medium priority',
            'low'       => 'Low priority',
            default     => 'Standard',
        };

        $url = match ($notifiable->role?->value) {
            'agency_admin', 'agent' => url('/agent/inspections'),  // closest existing index
            'landlord'              => url('/landlord/maintenance'),
            default                 => url('/dashboard'),
        };

        return (new MailMessage)
            ->subject("[{$urgencyTone}] New maintenance request: {$req->title}")
            ->greeting('Hi ' . $notifiable->name . ',')
            ->line("**{$req->submitter?->name}** has logged a new maintenance request at **{$req->property?->suburb}**.")
            ->line("**{$req->title}**")
            ->line($req->description ?: '— no description provided —')
            ->line('Category: ' . ucfirst($req->category) . ' · Urgency: ' . $urgencyTone)
            ->line($req->preferred_date ? 'Preferred date: ' . $req->preferred_date->format('d M Y') . ' (' . ($req->preferred_time_slot ?? 'any time') . ')' : '')
            ->action('Review request', $url)
            ->salutation('— Property Basket');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'request_id' => $this->request->id,
            'title'      => $this->request->title,
            'urgency'    => $this->request->urgency,
            'category'   => $this->request->category,
        ];
    }
}
