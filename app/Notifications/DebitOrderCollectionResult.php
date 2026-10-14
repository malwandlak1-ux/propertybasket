<?php

namespace App\Notifications;

use App\Models\DebitOrderCollection;
use App\Support\Edition;
use Carbon\CarbonImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * A debit-order collection succeeded (sent to the landlord / agency owner) or
 * failed (sent to them and the tenant).
 */
class DebitOrderCollectionResult extends Notification
{
    use Queueable;

    public function __construct(public DebitOrderCollection $collection) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $c = $this->collection->loadMissing(['rentPayment', 'lease.tenant', 'lease.listing']);
        $tenantName = $c->lease?->tenant?->name ?? 'Your tenant';
        $property = $c->lease?->listing?->address ?? $c->lease?->listing?->title ?? 'the property';
        $month = $c->rentPayment ? CarbonImmutable::parse($c->rentPayment->period_month . '-01')->format('F Y') : 'rent';
        $amount = 'R ' . number_format((float) $c->amount, 2);
        $isTenant = $notifiable->id === $c->lease?->tenant_id;
        $brand = Edition::brand()['name'];

        if ($c->status === 'succeeded') {
            return (new MailMessage)
                ->subject("Debit order collected: {$amount} from {$tenantName}")
                ->greeting('Hi ' . $notifiable->name . ',')
                ->line("{$month} rent of **{$amount}** for {$property} was collected by debit order from {$tenantName}.")
                ->line("Reference: {$c->reference}")
                ->action('View finance', url('/landlord/finance'))
                ->salutation("— {$brand}");
        }

        return (new MailMessage)
            ->subject("Debit order unsuccessful: {$month} rent")
            ->greeting('Hi ' . $notifiable->name . ',')
            ->line($isTenant
                ? "We could not collect your {$month} rent of **{$amount}** by debit order."
                : "The {$month} debit order of **{$amount}** for {$tenantName} ({$property}) did not go through.")
            ->line('Reason: ' . ($c->failure_reason ?: 'declined by the bank'))
            ->line($isTenant
                ? 'Please pay this month by EFT or online, and check the account on your debit order.'
                : 'The tenant has been asked to pay by EFT or online. It will be tried again on next month\'s debit date.')
            ->action($isTenant ? 'Pay now' : 'View tenants', url($isTenant ? '/tenant/payments' : '/landlord/tenants'))
            ->salutation("— {$brand}");
    }

    public function toArray(object $notifiable): array
    {
        return [
            'collection_id' => $this->collection->id,
            'status'        => $this->collection->status,
            'amount'        => (float) $this->collection->amount,
            'tenant'        => $this->collection->lease?->tenant?->name,
            'for_tenant'    => $notifiable->id === $this->collection->lease?->tenant_id,
        ];
    }
}
