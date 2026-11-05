<?php

namespace App\Notifications;

use App\Models\Inquiry;
use App\Notifications\Channels\ExpoPushChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class InquiryReceived extends Notification
{
    use Queueable;

    public function __construct(public Inquiry $inquiry)
    {
    }

    public function via(object $notifiable): array
    {
        return ['database', 'mail', ...ExpoPushChannel::for($notifiable)];
    }

    /** Mobile push: tapping it opens the lead in the app. */
    public function toExpoPush(object $notifiable): array
    {
        $listing = $this->inquiry->listing?->title;

        return [
            'title' => 'New lead: ' . $this->inquiry->name,
            'body'  => $listing ? "Inquired about {$listing}" : 'A new lead was assigned to you.',
            'data'  => ['type' => 'lead', 'inquiry_id' => $this->inquiry->id],
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $listing = $this->inquiry->listing;
        $url = url('/properties/'.$listing->slug);

        return (new MailMessage)
            ->subject('New inquiry: '.$listing->title)
            ->greeting('Hi '.$notifiable->name.',')
            ->line($this->inquiry->name.' just inquired about "'.$listing->title.'".')
            ->line('Email: '.$this->inquiry->email)
            ->line($this->inquiry->phone ? 'Phone: '.$this->inquiry->phone : 'No phone supplied.')
            ->line('Message:')
            ->line($this->inquiry->message ?: '— no message —')
            ->action('View listing', $url);
    }

    public function toArray(object $notifiable): array
    {
        return [
            'inquiry_id' => $this->inquiry->id,
            'listing_id' => $this->inquiry->listing_id,
            'listing_title' => $this->inquiry->listing?->title,
            'listing_slug' => $this->inquiry->listing?->slug,
            'visitor_name' => $this->inquiry->name,
            'visitor_email' => $this->inquiry->email,
            'visitor_phone' => $this->inquiry->phone,
            'message' => $this->inquiry->message,
            'allocation_method' => $this->inquiry->allocation_method,
        ];
    }
}
