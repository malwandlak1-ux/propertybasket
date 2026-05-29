<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Collection;

/**
 * Sent to an agent when one or more of their commission rows are approved
 * by an agency admin. Includes a per-deal breakdown.
 */
class CommissionApproved extends Notification
{
    use Queueable;

    /**
     * @param  Collection<int, \App\Models\Commission>  $commissions
     */
    public function __construct(public Collection $commissions) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $count   = $this->commissions->count();
        $netTotal = (float) $this->commissions->sum('agent_net');

        $msg = (new MailMessage)
            ->subject("Commission approved · {$count} " . ($count === 1 ? 'deal' : 'deals'))
            ->greeting('Hi ' . $notifiable->name . ',')
            ->line("Great news — your agency has approved {$count} of your commission " . ($count === 1 ? 'entry' : 'entries') . '.')
            ->line('Total net to be paid out: **R ' . number_format($netTotal, 2) . '**');

        foreach ($this->commissions->take(8) as $c) {
            $msg->line("• {$c->deal_type} · gross R " . number_format((float) $c->gross_commission, 2)
                . ' · your net R ' . number_format((float) $c->agent_net, 2));
        }

        if ($this->commissions->count() > 8) {
            $msg->line('… and ' . ($this->commissions->count() - 8) . ' more in your dashboard.');
        }

        return $msg
            ->line('Payment will be processed in the next payout batch.')
            ->action('View commission breakdown', url('/agent/commission'))
            ->salutation('— Property Basket');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'commission_ids' => $this->commissions->pluck('id')->all(),
            'count'          => $this->commissions->count(),
            'total_net'      => (float) $this->commissions->sum('agent_net'),
        ];
    }
}
