<?php

namespace App\Notifications;

use App\Models\Inquiry;
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
        return ['database', 'mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $listing = $this->inquiry->listing;
        // General / valuation enquiries from an agency website have no listing.
        $subject = $listing ? $listing->title : 'website enquiry';
        $url = $listing ? url('/properties/'.$listing->slug) : url('/agent/crm/pipeline');

        return (new MailMessage)
            ->subject('New inquiry: '.$subject)
            ->greeting('Hi '.$notifiable->name.',')
            ->line($listing
                ? $this->inquiry->name.' just inquired about "'.$listing->title.'".'
                : $this->inquiry->name.' sent an enquiry through your agency website.')
            ->line('Email: '.$this->inquiry->email)
            ->line($this->inquiry->phone ? 'Phone: '.$this->inquiry->phone : 'No phone supplied.')
            ->line('Message:')
            ->line($this->inquiry->message ?: '— no message —')
            ->action($listing ? 'View listing' : 'Open pipeline', $url);
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
