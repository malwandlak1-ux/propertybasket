<?php

namespace App\Notifications;

use App\Models\MaintenanceQuote;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to whoever manages the property (landlord or agency owner) when a
 * contractor sends a quote that needs approving.
 */
class QuoteSubmitted extends Notification
{
    use Queueable;

    public function __construct(public MaintenanceQuote $quote) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $quote = $this->quote->loadMissing(['request.property', 'contractor.user']);
        $ref   = 'QT-' . str_pad((string) $quote->id, 6, '0', STR_PAD_LEFT);

        return (new MailMessage)
            ->subject("Quote {$ref} to approve: " . ($quote->request?->title ?? 'maintenance job'))
            ->greeting('Hi ' . $notifiable->name . ',')
            ->line(($quote->contractor?->business_name ?? $quote->contractor?->user?->name ?? 'A contractor') . " has sent quote **{$ref}**.")
            ->line('Job: ' . ($quote->request?->title ?? '—'))
            ->line('Property: ' . ($quote->request?->property?->address ?? $quote->request?->property?->title ?? '—'))
            ->line('**Total: R ' . number_format((float) $quote->total, 2) . '**')
            ->action('Review quote', url($this->href($notifiable)))
            ->line('The contractor can only schedule the work once you accept the quote.')
            ->salutation('— Property Basket');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'quote_id'               => $this->quote->id,
            'maintenance_request_id' => $this->quote->maintenance_request_id,
            'contractor'             => $this->quote->contractor?->business_name,
            'total'                  => (float) $this->quote->total,
            'href'                   => $this->href($notifiable),
        ];
    }

    private function href(object $notifiable): string
    {
        return ($notifiable->role?->value ?? null) === 'landlord' ? '/landlord/maintenance' : '/agency/maintenance/quotes';
    }
}
