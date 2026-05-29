<?php

namespace App\Services;

use App\Models\Inspection;
use App\Models\Lease;
use App\Models\MaintenanceInvoice;
use App\Models\RentPayment;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Response;

/**
 * Builds PDF download responses for the four document types the platform owns:
 *   - rent receipts          (per rent_payment row)
 *   - maintenance invoices   (per maintenance_invoice row)
 *   - lease agreement summary (per lease row)
 *   - inspection reports     (per inspection row)
 *
 * Each method returns a `\Illuminate\Http\Response` with the PDF inline-streamed.
 * Callers control whether to download or display via the `?download=1` query string.
 */
class PdfService
{
    /**
     * @param  bool  $download  If true, force file download. Else inline (browser preview).
     */
    public function rentReceipt(RentPayment $payment, bool $download = false): Response
    {
        $payment->loadMissing(['lease.listing', 'lease.tenant', 'lease.agency', 'lease.agent', 'lease.landlord']);
        $lease = $payment->lease;

        $pdf = Pdf::loadView('pdfs.rent-receipt', [
            'payment'      => $payment,
            'lease'        => $lease,
            'tenant'       => $lease->tenant,
            'listing'      => $lease->listing,
            'agencyName'   => $lease->agency?->name,
            'landlordName' => $lease->landlord?->name,
            'agentName'    => $lease->agent?->name,
        ])->setPaper('A4');

        $filename = "rent-receipt-{$payment->period_month}-" . str_pad($payment->id, 6, '0', STR_PAD_LEFT) . '.pdf';
        return $download ? $pdf->download($filename) : $pdf->stream($filename);
    }

    public function maintenanceInvoice(MaintenanceInvoice $invoice, bool $download = false): Response
    {
        $invoice->loadMissing([
            'request.property.owner',
            'request.submitter',
            'contractor.user',
        ]);

        $request    = $invoice->request;
        $property   = $request?->property;
        $billedTo   = $property?->owner?->name ?? '—';

        $pdf = Pdf::loadView('pdfs.maintenance-invoice', [
            'invoice'    => $invoice,
            'request'    => $request,
            'property'   => $property,
            'contractor' => $invoice->contractor,
            'billedTo'   => $billedTo,
        ])->setPaper('A4');

        $filename = 'invoice-INV-' . str_pad($invoice->id, 6, '0', STR_PAD_LEFT) . '.pdf';
        return $download ? $pdf->download($filename) : $pdf->stream($filename);
    }

    public function leaseAgreement(Lease $lease, bool $download = false): Response
    {
        $lease->loadMissing(['listing', 'tenant', 'agency', 'agent', 'landlord']);

        $pdf = Pdf::loadView('pdfs.lease-agreement', [
            'lease'        => $lease,
            'listing'      => $lease->listing,
            'tenant'       => $lease->tenant,
            'agencyName'   => $lease->agency?->name,
            'landlordName' => $lease->landlord?->name,
            'agentName'    => $lease->agent?->name,
        ])->setPaper('A4');

        $filename = 'lease-LSE-' . str_pad($lease->id, 6, '0', STR_PAD_LEFT) . '.pdf';
        return $download ? $pdf->download($filename) : $pdf->stream($filename);
    }

    public function inspectionReport(Inspection $inspection, bool $download = false): Response
    {
        $inspection->loadMissing(['lease.listing', 'tenant', 'conductor']);

        $pdf = Pdf::loadView('pdfs.inspection-report', [
            'inspection' => $inspection,
            'listing'    => $inspection->lease?->listing,
            'tenant'     => $inspection->tenant,
            'conductor'  => $inspection->conductor,
        ])->setPaper('A4');

        $filename = strtolower($inspection->type) . '-inspection-INS-' . str_pad($inspection->id, 6, '0', STR_PAD_LEFT) . '.pdf';
        return $download ? $pdf->download($filename) : $pdf->stream($filename);
    }
}
