<?php

namespace App\Notifications;

use App\Models\WaMessage;
use App\Support\Phone;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * An owner wrote to the agent's WhatsApp Business number. In-app only (bell),
 * sent synchronously so it shows on the agent's next bell refresh.
 */
class WhatsAppMessageReceived extends Notification
{
    use Queueable;

    public function __construct(public WaMessage $message, public ?string $ownerName = null, public bool $optedOut = false)
    {
    }

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'wa_message_id' => $this->message->id,
            'phone'         => $this->message->phone,
            'display'       => Phone::local($this->message->phone),
            'owner_name'    => $this->ownerName,
            'preview'       => mb_strimwidth((string) $this->message->body, 0, 120, '…'),
            'opted_out'     => $this->optedOut,
        ];
    }
}
