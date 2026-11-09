<?php

namespace App\Notifications;

use App\Models\RentalApplication;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Tells the applicant their rental application was approved or declined. */
class RentalApplicationDecision extends Notification
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
        $property = $a->listing?->title ?? 'the property';
        $approved = $a->status === 'approved';
        $m = (new MailMessage)
            ->subject(($approved ? 'Your rental application was approved' : 'Update on your rental application') . " · {$a->agency->name}")
            ->greeting('Hi ' . $a->applicantName() . ',');
        if ($approved) {
            $m->line("Good news: your application for **{$property}** has been approved.")
                ->line('Your agent will be in touch about the lease and deposit.');
        } else {
            $m->line("Thank you for applying for **{$property}**. Unfortunately your application was not successful this time.");
        }
        if ($a->decision_note) {
            $m->line('Note from the agent: ' . $a->decision_note);
        }
        if ($a->agent) {
            $m->replyTo($a->agent->email, $a->agent->name);
        }

        return $m->salutation('— ' . $a->agency->name);
    }
}
