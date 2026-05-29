<?php

namespace App\Notifications;

use App\Models\RentPayment;
use App\Services\PdfService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to the tenant when their rent payment is marked paid.
 * Attaches the PDF receipt. Queued because PDF rendering is slow (~500ms+).
 */
class RentPaymentReceived extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public RentPayment $payment) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $payment = $this->payment->loadMissing(['lease.listing']);
        $period  = \Carbon\Carbon::createFromFormat('Y-m', $payment->period_month)->format('F Y');
        $url     = url('/tenant/payments');

        $msg = (new MailMessage)
            ->subject("Rent receipt — {$period}")
            ->greeting('Hi ' . $notifiable->name . ',')
            ->line("We've received your rent payment for {$period}.")
            ->line('Amount: **R ' . number_format((float) $payment->amount, 2) . '**')
            ->line('Property: ' . ($payment->lease->listing->address ?? $payment->lease->listing->title))
            ->line('Paid on: ' . $payment->paid_at->format('d M Y \a\t H:i'))
            ->line('Reference: ' . ($payment->paystack_reference ?? '—'))
            ->action('View payment history', $url)
            ->line('A PDF copy of your receipt is attached. Keep it for your records.')
            ->salutation('— Property Basket');

        // Attach PDF receipt (generated on the fly).
        try {
            $pdfBinary = app(PdfService::class)
                ->rentReceipt($payment, download: true)
                ->getContent();
            $msg->attachData($pdfBinary, "rent-receipt-{$payment->period_month}.pdf", [
                'mime' => 'application/pdf',
            ]);
        } catch (\Throwable $e) {
            // If PDF generation fails, send the email without attachment rather than
            // dropping the whole notification.
            report($e);
        }

        return $msg;
    }

    public function toArray(object $notifiable): array
    {
        return [
            'payment_id' => $this->payment->id,
            'period'     => $this->payment->period_month,
            'amount'     => (float) $this->payment->amount,
        ];
    }
}
