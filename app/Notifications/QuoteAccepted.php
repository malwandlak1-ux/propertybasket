<?php

namespace App\Notifications;

use App\Models\MaintenanceQuote;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to the contractor when an agency accepts their quote on a maintenance
 * job. Unblocks scheduling on the contractor side.
 */
class QuoteAccepted extends Notification
{
    use Queueable;

    public function __construct(public MaintenanceQuote $quote) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $quote = $this->quote->loadMissing('request.property');
        $ref   = 'QT-' . str_pad((string) $quote->id, 6, '0', STR_PAD_LEFT);

        return (new MailMessage)
            ->subject("Quote {$ref} accepted — you can schedule the job")
            ->greeting('Hi ' . $notifiable->name . ',')
            ->line("Your quote **{$ref}** has been accepted by the agency.")
            ->line('Job: ' . ($quote->request?->title ?? '—'))
            ->line('Property: ' . ($quote->request?->property?->title ?? '—'))
            ->line('Total: R ' . number_format((float) $quote->total, 2))
            ->line('You can now schedule the work from your Job Requests page.')
            ->action('Schedule job', url('/contractor/requests'))
            ->salutation('— Property Basket');
    }

    public function toArray(object $notifiable): array
    {
        $quote = $this->quote->loadMissing('request');
        return [
            'quote_id'    => $this->quote->id,
            'reference'   => 'QT-' . str_pad((string) $this->quote->id, 6, '0', STR_PAD_LEFT),
            'request_id'  => $quote->maintenance_request_id,
            'job_title'   => $quote->request?->title,
            'total'       => (float) $quote->total,
        ];
    }
}
