<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Email sent to the Information Officer when a data subject exercises a POPIA
 * right via /privacy-portal. Routed on-demand — recipient is the inbox
 * configured in PrivacyPortalController.
 */
class PrivacyRequestSubmitted extends Notification
{
    use Queueable;

    public function __construct(
        public string $requesterName,
        public string $requesterEmail,
        public string $requestType,
        public ?string $details = null,
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $labels = [
            'access'     => 'Right of access — copy of personal info we hold',
            'correction' => 'Right to correction — update inaccurate info',
            'deletion'   => 'Right to deletion / erasure',
            'objection'  => 'Right to object to processing',
            'portability'=> 'Right to data portability — machine-readable export',
            'other'      => 'Other / general enquiry',
        ];

        $label = $labels[$this->requestType] ?? $this->requestType;

        $message = (new MailMessage)
            ->subject('POPIA request — '.$label)
            ->greeting('A new privacy request has arrived.')
            ->line('A data subject has submitted a request via the Privacy Portal.')
            ->line('Requester: '.$this->requesterName)
            ->line('Email: '.$this->requesterEmail)
            ->line('Request type: '.$label)
            ->line('Details: '.($this->details ?: '— none provided —'))
            ->line('Reminder: POPIA gives the Information Officer up to 30 days to respond. Acknowledge receipt within 3 business days.')
            ->action('Reply by email', 'mailto:'.$this->requesterEmail);

        if (filter_var($this->requesterEmail, FILTER_VALIDATE_EMAIL)) {
            $message->replyTo($this->requesterEmail, $this->requesterName);
        }

        return $message;
    }
}
