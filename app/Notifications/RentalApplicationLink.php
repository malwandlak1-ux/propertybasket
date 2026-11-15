<?php

namespace App\Notifications;

use App\Models\RentalApplication;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Emails a prospect tenant their personal rental application link. */
class RentalApplicationLink extends Notification
{
    use Queueable;

    public function __construct(public RentalApplication $application) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $a = $this->application->loadMissing(['agency', 'listing', 'agent']);
        $property = $a->listing?->title;
        $m = (new MailMessage)
            ->subject('Your rental application' . ($property ? " for {$property}" : '') . " · {$a->agency->name}")
            ->greeting('Hi ' . ($a->invitee_name ?: 'there') . ',')
            ->line("{$a->agency->name} has invited you to apply" . ($property ? " for **{$property}**" . ($a->listing->suburb ? " in {$a->listing->suburb}" : '') : ' for a rental') . '.')
            ->line('It takes about 10 minutes. Have these ready: your ID, latest 3 months’ payslips and bank statements (6 months if self-employed), and proof of residence.')
            ->action('Start my application', $a->url())
            ->line('You can stop and come back to this link at any time; your answers are saved.');
        if ($a->agent) {
            $m->replyTo($a->agent->email, $a->agent->name)->line("Questions? Reply to this email to reach {$a->agent->name}.");
        }

        return $m->salutation('— ' . $a->agency->name);
    }
}
