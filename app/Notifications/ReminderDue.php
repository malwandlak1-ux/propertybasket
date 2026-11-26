<?php

namespace App\Notifications;

use App\Models\AgentReminder;
use App\Notifications\Channels\ExpoPushChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/** One of the agent's calendar reminders is due. Bell, plus a phone push when the agent has the app. */
class ReminderDue extends Notification
{
    use Queueable;

    public function __construct(public AgentReminder $reminder)
    {
    }

    public function via(object $notifiable): array
    {
        return ['database', ...ExpoPushChannel::for($notifiable)];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'reminder_id' => $this->reminder->id,
            'title'       => $this->reminder->title,
            'date'        => $this->reminder->remind_at->format('Y-m-d'),
            'time'        => $this->reminder->remind_at->format('H:i'),
        ];
    }

    /** Mobile push: tapping it opens the calendar on the reminder's day. */
    public function toExpoPush(object $notifiable): array
    {
        return [
            'title' => 'Reminder · ' . $this->reminder->remind_at->format('H:i'),
            'body'  => $this->reminder->title,
            'data'  => [
                'type'        => 'reminder',
                'reminder_id' => $this->reminder->id,
                'date'        => $this->reminder->remind_at->format('Y-m-d'),
            ],
        ];
    }
}
