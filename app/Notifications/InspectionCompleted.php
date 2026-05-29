<?php

namespace App\Notifications;

use App\Models\Inspection;
use App\Services\PdfService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to all parties (tenant + inspector + agency/landlord) when an
 * inspection is marked completed and both signatures are captured.
 * Attaches the PDF inspection report. Queued because PDF rendering is slow.
 */
class InspectionCompleted extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Inspection $inspection) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $insp = $this->inspection->loadMissing(['lease.listing', 'conductor', 'tenant']);
        $listing = $insp->lease?->listing;
        $typeLabel = match ($insp->type) {
            'move_in'  => 'Move-In Inspection',
            'move_out' => 'Move-Out Inspection',
            'routine'  => 'Routine Inspection',
            default    => ucwords(str_replace('_', ' ', $insp->type)) . ' Inspection',
        };

        $msg = (new MailMessage)
            ->subject("{$typeLabel} completed — {$listing?->title}")
            ->greeting('Hi ' . $notifiable->name . ',')
            ->line("The **{$typeLabel}** for **{$listing?->address}** has been completed and signed by both parties.")
            ->line('Rooms inspected: ' . count(is_array($insp->rooms) ? $insp->rooms : []))
            ->line('Inspector: ' . ($insp->conductor?->name ?? '—'))
            ->line('Tenant: ' . ($insp->tenant?->name ?? '—'));

        if ((float) $insp->deduction_total > 0) {
            $msg->line('Deductions proposed: **R ' . number_format((float) $insp->deduction_total, 2) . '** (see attached report)');
        } else {
            $msg->line('No deductions proposed.');
        }

        $msg->line('The full report is attached as a PDF for your records.')
            ->action('View inspection', url('/agent/inspections'))
            ->salutation('— Property Basket');

        // Attach PDF
        try {
            $pdfBinary = app(PdfService::class)
                ->inspectionReport($insp, download: true)
                ->getContent();
            $filename = strtolower($insp->type) . '-inspection-INS-'
                . str_pad((string) $insp->id, 6, '0', STR_PAD_LEFT) . '.pdf';
            $msg->attachData($pdfBinary, $filename, ['mime' => 'application/pdf']);
        } catch (\Throwable $e) {
            report($e);
        }

        return $msg;
    }

    public function toArray(object $notifiable): array
    {
        return [
            'inspection_id' => $this->inspection->id,
            'type'          => $this->inspection->type,
            'listing'       => $this->inspection->lease?->listing?->title,
        ];
    }
}
