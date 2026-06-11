<?php

namespace App\Notifications;

use App\Models\Lease;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to the agent (and landlord) when the tenant electronically signs
 * the lease from their Documents page.
 */
class LeaseSigned extends Notification
{
    use Queueable;

    public function __construct(public Lease $lease) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $tenant   = $this->lease->tenant;
        $property = $this->lease->listing?->title ?? 'the property';

        return (new MailMessage)
            ->subject('Lease signed: ' . $property)
            ->greeting('Hi ' . $notifiable->name . ',')
            ->line(($tenant?->name ?? 'The tenant') . ' has signed the lease for "' . $property . '".')
            ->line('Signed: ' . $this->lease->tenant_signed_at?->format('d M Y · H:i'))
            ->line('Lease period: ' . $this->lease->start_date?->format('d M Y') . ' — ' . $this->lease->end_date?->format('d M Y'))
            ->action('View lease', url('/agent/tenants'))
            ->salutation('— The Property Basket team');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'lease_id'      => $this->lease->id,
            'listing_id'    => $this->lease->listing_id,
            'listing_title' => $this->lease->listing?->title,
            'tenant_name'   => $this->lease->tenant?->name,
            'signed_at'     => $this->lease->tenant_signed_at?->toIso8601String(),
        ];
    }
}
