<?php

namespace App\Notifications;

use App\Models\DebitOrder;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to whoever manages the lease (landlord or agency owner) when a tenant
 * activates, changes or cancels their rent debit-order mandate.
 */
class DebitOrderChanged extends Notification
{
    use Queueable;

    /** @param 'activated'|'updated'|'cancelled' $event */
    public function __construct(public DebitOrder $debitOrder, public string $event) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $do = $this->debitOrder->loadMissing(['tenant', 'lease.listing']);
        $tenant = $do->tenant?->name ?? 'A tenant';
        $property = $do->lease?->listing?->address ?? $do->lease?->listing?->title ?? 'their property';
        $masked = str_repeat('•', max(strlen((string) $do->account_number) - 4, 0)) . substr((string) $do->account_number, -4);

        $mail = (new MailMessage)->greeting('Hi ' . $notifiable->name . ',');

        if ($this->event === 'cancelled') {
            return $mail
                ->subject("Debit order cancelled: {$tenant}")
                ->line("**{$tenant}** has cancelled their rent debit order for {$property}.")
                ->line('Rent will now need to be paid by EFT or online.')
                ->action('View tenants', url('/landlord/tenants'))
                ->salutation('— ' . \App\Support\Edition::brand()['name']);
        }

        return $mail
            ->subject(($this->event === 'activated' ? 'Debit order activated: ' : 'Debit order updated: ') . $tenant)
            ->line("**{$tenant}** has " . ($this->event === 'activated' ? 'authorised' : 'updated') . " a rent debit order for {$property}.")
            ->line("Debit day: **{$do->debit_day}** of each month")
            ->line("Account: {$do->bank_name} · {$do->account_holder} · {$masked} · branch {$do->branch_code} ({$do->account_type})")
            ->action('View tenants', url('/landlord/tenants'))
            ->salutation('— ' . \App\Support\Edition::brand()['name']);
    }

    public function toArray(object $notifiable): array
    {
        return [
            'debit_order_id' => $this->debitOrder->id,
            'event'          => $this->event,
            'tenant'         => $this->debitOrder->tenant?->name,
            'debit_day'      => $this->debitOrder->debit_day,
        ];
    }
}
