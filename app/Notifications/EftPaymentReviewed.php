<?php

namespace App\Notifications;

use App\Models\EftPayment;
use App\Support\Edition;
use Carbon\CarbonImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Tells the tenant their EFT was confirmed (rent paid) or could not be matched. */
class EftPaymentReviewed extends Notification
{
    use Queueable;

    public function __construct(public EftPayment $eft) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $e = $this->eft->loadMissing('rentPayment');
        $month = $e->rentPayment ? CarbonImmutable::parse($e->rentPayment->period_month . '-01')->format('F Y') : 'rent';
        $amount = 'R ' . number_format((float) $e->amount, 2);
        $mail = (new MailMessage)->greeting('Hi ' . $notifiable->name . ',');

        if ($e->status === 'confirmed') {
            return $mail
                ->subject("EFT received: {$month} rent")
                ->line("Your EFT of **{$amount}** for {$month} rent has been received and your rent is marked paid.")
                ->action('View payments', url('/tenant/payments'))
                ->salutation('— ' . Edition::brand()['name']);
        }

        return $mail
            ->subject("EFT not confirmed: {$month} rent")
            ->line("Your EFT of {$amount} for {$month} rent could not be confirmed.")
            ->line('Reason: ' . ($e->reject_reason ?: 'the payment was not found in the account'))
            ->line('Please check the payment with your bank, or pay again online or by EFT.')
            ->action('View payments', url('/tenant/payments'))
            ->salutation('— ' . Edition::brand()['name']);
    }

    public function toArray(object $notifiable): array
    {
        return [
            'eft_payment_id' => $this->eft->id,
            'status'         => $this->eft->status,
            'amount'         => (float) $this->eft->amount,
            'reason'         => $this->eft->reject_reason,
        ];
    }
}
