<?php

namespace App\Notifications;

use App\Models\MaintenanceInvoice;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to whoever manages the property (landlord or agency owner) when a
 * contractor submits an invoice for a job.
 */
class InvoiceSubmitted extends Notification
{
    use Queueable;

    public function __construct(public MaintenanceInvoice $invoice) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $inv = $this->invoice->loadMissing(['request.property', 'contractor.user']);
        $ref = 'INV-' . str_pad((string) $inv->id, 6, '0', STR_PAD_LEFT);

        $mail = (new MailMessage)
            ->subject("Invoice {$ref} received: " . ($inv->request?->title ?? 'maintenance job'))
            ->greeting('Hi ' . $notifiable->name . ',')
            ->line(($inv->contractor?->business_name ?? $inv->contractor?->user?->name ?? 'A contractor') . " has invoiced **{$ref}**.")
            ->line('Job: ' . ($inv->request?->title ?? '—'))
            ->line('**Total: R ' . number_format((float) $inv->invoice_total, 2) . '**');

        if (abs((float) $inv->deviation_amount) > 0.01) {
            $mail->line('Differs from the accepted quote by R ' . number_format((float) $inv->deviation_amount, 2) . ': ' . ($inv->deviation_notes ?? ''));
        }

        return $mail
            ->action('Review invoice', url($this->href($notifiable)))
            ->salutation('— Property Basket');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'invoice_id'             => $this->invoice->id,
            'maintenance_request_id' => $this->invoice->maintenance_request_id,
            'total'                  => (float) $this->invoice->invoice_total,
            'href'                   => $this->href($notifiable),
        ];
    }

    private function href(object $notifiable): string
    {
        return ($notifiable->role?->value ?? null) === 'landlord' ? '/landlord/maintenance' : '/agency/commission';
    }
}
