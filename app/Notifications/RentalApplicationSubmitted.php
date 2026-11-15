<?php

namespace App\Notifications;

use App\Models\RentalApplication;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** A prospect submitted their rental application: tell the agent handling it. */
class RentalApplicationSubmitted extends Notification
{
    use Queueable;

    public function __construct(public RentalApplication $application, public string $href) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $a = $this->application->loadMissing('listing');
        $income = $a->grossIncome();

        return (new MailMessage)
            ->subject('Rental application received: ' . $a->applicantName() . ($a->listing ? " · {$a->listing->title}" : ''))
            ->greeting('Hi ' . $notifiable->name . ',')
            ->line('**' . $a->applicantName() . '** submitted a rental application' . ($a->listing ? " for **{$a->listing->title}**" : '') . '.')
            ->line('Employment: ' . ($a->employment_type === 'self_employed' ? 'self-employed' : 'salary earner') . ($income > 0 ? ' · gross income R ' . number_format($income, 0, '.', ' ') . ' per month' : ''))
            ->line($a->documents()->count() . ' document(s) uploaded.')
            ->action('Review application', url($this->href));
    }

    public function toArray(object $notifiable): array
    {
        return [
            'application_id' => $this->application->id,
            'applicant' => $this->application->applicantName(),
            'listing' => $this->application->listing?->title,
            'href' => $this->href,
        ];
    }
}
