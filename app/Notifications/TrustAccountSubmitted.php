<?php

namespace App\Notifications;

use App\Models\Agency;
use App\Support\Edition;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** An agency captured (or changed) its trust account: a super admin must verify it. */
class TrustAccountSubmitted extends Notification
{
    use Queueable;

    public function __construct(public Agency $agency, public bool $changed = false) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $a = $this->agency;

        return (new MailMessage)
            ->subject("Trust account to verify: {$a->name}")
            ->greeting('Hi ' . $notifiable->name . ',')
            ->line("**{$a->name}** " . ($this->changed ? 'changed' : 'captured') . ' its trust account details and is waiting for platform verification.')
            ->line("Bank: {$a->trust_bank} · Account holder: {$a->trust_account_holder}")
            ->line("Auditor: {$a->trust_auditor_name} (IRBA {$a->trust_auditor_practice_number})")
            ->line('Check the details against the agency’s bank confirmation letter, then mark the trust account verified.')
            ->action('Review trust account', url('/admin/agencies?trust=' . $a->id))
            ->salutation('— ' . Edition::brand()['name']);
    }

    public function toArray(object $notifiable): array
    {
        return [
            'agency_id'   => $this->agency->id,
            'agency_name' => $this->agency->name,
            'bank'        => $this->agency->trust_bank,
            'changed'     => $this->changed,
        ];
    }
}
