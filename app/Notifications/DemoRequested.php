<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Lead email sent when a visitor fills the "Book a demo" form on the public
 * site. Routed on-demand via Notification::route('mail', 'info@...').
 */
class DemoRequested extends Notification
{
    use Queueable;

    public function __construct(
        public string $visitorName,
        public string $visitorEmail,
        public string $visitorPhone,
        public ?string $visitorMessage = null,
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $reply = filter_var($this->visitorEmail, FILTER_VALIDATE_EMAIL)
            ? $this->visitorEmail
            : null;

        $message = (new MailMessage)
            ->subject('New demo request — '.$this->visitorName)
            ->greeting('A new demo lead has arrived.')
            ->line('Someone just asked to book a demo via the Property Basket website.')
            ->line('Name: '.$this->visitorName)
            ->line('Email: '.$this->visitorEmail)
            ->line('Phone: '.$this->visitorPhone)
            ->line('Message: '.($this->visitorMessage ?: '— no message —'))
            ->action('Reply by email', 'mailto:'.$this->visitorEmail)
            ->line('Action this lead within 24 hours for the best conversion.');

        if ($reply) {
            $message->replyTo($reply, $this->visitorName);
        }

        return $message;
    }
}
