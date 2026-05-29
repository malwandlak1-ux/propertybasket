<?php

namespace App\Notifications;

use App\Models\MaintenanceQuote;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to the contractor when an agency rejects their quote. The job stays
 * re-quotable so they can revise and resubmit.
 */
class QuoteRejected extends Notification
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
            ->subject("Quote {$ref} not accepted")
            ->greeting('Hi ' . $notifiable->name . ',')
            ->line("The agency reviewed your quote **{$ref}** and didn't accept it.")
            ->line('Job: ' . ($quote->request?->title ?? '—'))
            ->line('You can revise and resubmit a new quote from the Job Requests page.')
            ->action('Review job', url('/contractor/requests'))
            ->salutation('— Property Basket');
    }

    public function toArray(object $notifiable): array
    {
        $quote = $this->quote->loadMissing('request');
        return [
            'quote_id'   => $this->quote->id,
            'reference'  => 'QT-' . str_pad((string) $this->quote->id, 6, '0', STR_PAD_LEFT),
            'request_id' => $quote->maintenance_request_id,
            'job_title'  => $quote->request?->title,
        ];
    }
}
