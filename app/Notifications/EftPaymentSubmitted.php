<?php

namespace App\Notifications;

use App\Models\EftPayment;
use App\Support\Edition;
use Carbon\CarbonImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** A tenant says they've paid rent by EFT: the lease manager must confirm it. */
class EftPaymentSubmitted extends Notification
{
    use Queueable;

    public function __construct(public EftPayment $eft) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $e = $this->eft->loadMissing(['tenant', 'lease.listing', 'rentPayment']);
        $month = $e->rentPayment ? CarbonImmutable::parse($e->rentPayment->period_month . '-01')->format('F Y') : 'rent';
        $amount = 'R ' . number_format((float) $e->amount, 2);

        return (new MailMessage)
            ->subject("EFT to confirm: {$amount} from " . ($e->tenant?->name ?? 'a tenant'))
            ->greeting('Hi ' . $notifiable->name . ',')
            ->line(($e->tenant?->name ?? 'A tenant') . " says they paid **{$amount}** by EFT on " . $e->paid_on->format('d M Y') . " for {$month} rent.")
            ->line('Reference: ' . ($e->reference ?: '—') . ($e->proof_path ? ' · proof of payment attached in the portal' : ''))
            ->line('Check that it reflects in your bank account, then confirm it so the rent is marked paid.')
            ->action('Review EFT payments', url('/landlord/finance'))
            ->salutation('— ' . Edition::brand()['name']);
    }

    public function toArray(object $notifiable): array
    {
        return [
            'eft_payment_id' => $this->eft->id,
            'tenant'         => $this->eft->tenant?->name,
            'amount'         => (float) $this->eft->amount,
        ];
    }
}
