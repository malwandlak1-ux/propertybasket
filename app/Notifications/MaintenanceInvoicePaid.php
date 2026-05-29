<?php

namespace App\Notifications;

use App\Models\MaintenanceInvoice;
use App\Support\PlatformPlans;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to the contractor when their invoice is paid.
 */
class MaintenanceInvoicePaid extends Notification
{
    use Queueable;

    public function __construct(public MaintenanceInvoice $invoice) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $inv  = $this->invoice->loadMissing('request');
        $gross = (float) $inv->invoice_total;
        $fee  = round($gross * PlatformPlans::CONTRACTOR_FEE_PERCENT / 100, 2);
        $net  = $gross - $fee;

        return (new MailMessage)
            ->subject('Invoice paid — R ' . number_format($net, 2) . ' on its way')
            ->greeting('Hi ' . $notifiable->name . ',')
            ->line('Your invoice **INV-' . str_pad((string) $inv->id, 6, '0', STR_PAD_LEFT) . '** has been paid:')
            ->line('Job: ' . ($inv->request?->title ?? '—'))
            ->line('Gross invoice: R ' . number_format($gross, 2))
            ->line('Platform fee (' . PlatformPlans::CONTRACTOR_FEE_PERCENT . '%): − R ' . number_format($fee, 2))
            ->line('**Net to your account: R ' . number_format($net, 2) . '**')
            ->line('Funds will reflect in your bank account within 1–2 business days.')
            ->action('View payouts', url('/contractor/finance'))
            ->salutation('— Property Basket');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'invoice_id' => $this->invoice->id,
            'total'      => (float) $this->invoice->invoice_total,
            'paid_at'    => $this->invoice->paid_at?->toIso8601String(),
        ];
    }
}
