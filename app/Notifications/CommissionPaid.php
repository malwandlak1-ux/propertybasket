<?php

namespace App\Notifications;

use App\Models\PayoutBatch;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Collection;

/**
 * Sent to an agent when a payout batch they were included in is executed.
 */
class CommissionPaid extends Notification
{
    use Queueable;

    /**
     * @param  Collection<int, \App\Models\Commission>  $commissions  This agent's commissions in the batch.
     */
    public function __construct(public PayoutBatch $batch, public Collection $commissions) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $count    = $this->commissions->count();
        $netTotal = (float) $this->commissions->sum('agent_net');

        return (new MailMessage)
            ->subject('Payment sent — R ' . number_format($netTotal, 2))
            ->greeting('Hi ' . $notifiable->name . ',')
            ->line("Your commission payout has been processed via Paystack.")
            ->line('Amount: **R ' . number_format($netTotal, 2) . '** for ' . $count . ' ' . ($count === 1 ? 'deal' : 'deals'))
            ->line('Batch date: ' . $this->batch->batch_date->format('d M Y'))
            ->line('Funds should reflect in your bank account within 1–2 business days.')
            ->action('View payment ledger', url('/agent/commission'))
            ->line('Tax summary: please retain this email for your SARS records.')
            ->salutation('— Property Basket');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'batch_id'       => $this->batch->id,
            'batch_date'     => $this->batch->batch_date->toDateString(),
            'commission_ids' => $this->commissions->pluck('id')->all(),
            'total_net'      => (float) $this->commissions->sum('agent_net'),
        ];
    }
}
