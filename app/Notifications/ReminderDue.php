<?php

namespace App\Notifications;

use App\Models\AgentReminder;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/** One of the agent's calendar reminders is due. In-app only (bell). */
class ReminderDue extends Notification
{
    use Queueable;

    public function __construct(public AgentReminder $reminder)
    {
    }

    public function via(object $notifiable): array
    {
        return ['database'];
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
}
