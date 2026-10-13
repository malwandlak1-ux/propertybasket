<?php

namespace App\Services;

use App\Models\Agency;
use App\Models\Landlord;
use App\Models\MaintenanceInvoice;
use App\Models\MaintenanceQuote;
use App\Models\MaintenanceRequest;
use App\Models\User;
use App\Notifications\MaintenanceInvoicePaid;
use App\Notifications\QuoteAccepted;
use App\Notifications\QuoteRejected;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

/**
 * Quote → approve → work → invoice → pay steps shared by whoever manages the
 * property (agency admin or the landlord themself).
 */
class MaintenanceWorkflow
{
    /**
     * Accept a quote so the contractor can schedule the job. Competing quotes
     * on the same job are rejected and their contractors told.
     */
    public function acceptQuote(MaintenanceQuote $quote): void
    {
        $competing = MaintenanceQuote::where('maintenance_request_id', $quote->maintenance_request_id)
            ->where('id', '!=', $quote->id)
            ->whereIn('status', ['sent', 'draft'])
            ->with('contractor.user')
            ->get();
        MaintenanceQuote::whereIn('id', $competing->pluck('id'))->update(['status' => 'rejected']);

        $quote->update(['status' => 'accepted']);

        $winner = $quote->loadMissing('contractor.user')->contractor?->user;
        if ($winner) {
            $winner->notify(new QuoteAccepted($quote));
        }
        foreach ($competing as $loser) {
            $loserUser = $loser->contractor?->user;
            if ($loserUser && (! $winner || $loserUser->id !== $winner->id)) {
                $loserUser->notify(new QuoteRejected($loser));
            }
        }
    }

    public function rejectQuote(MaintenanceQuote $quote): void
    {
        $quote->update(['status' => 'rejected']);

        $contractorUser = $quote->loadMissing('contractor.user')->contractor?->user;
        if ($contractorUser) {
            $contractorUser->notify(new QuoteRejected($quote));
        }
    }

    /** Record a contractor invoice as paid and close the job. */
    public function markInvoicePaid(MaintenanceInvoice $invoice, ?string $reference = null): void
    {
        $invoice->update([
            'status'             => 'paid',
            'paid_at'            => now(),
            'approved_at'        => $invoice->approved_at ?? now(),
            'paystack_reference' => $reference ?? $invoice->paystack_reference,
        ]);

        $invoice->loadMissing(['request', 'contractor.user']);
        if ($invoice->request && in_array($invoice->request->status, ['in_progress', 'completed'], true)) {
            $invoice->request->update(['status' => 'paid']);
        }

        if ($invoice->contractor?->user) {
            try {
                $invoice->contractor->user->notify(new MaintenanceInvoicePaid($invoice));
            } catch (\Throwable $e) {
                report($e);
            }
        }
    }

    /** The person who approves quotes and pays invoices for this job's property. */
    public static function managerOf(MaintenanceRequest $request): ?User
    {
        $property = $request->loadMissing('property')->property;

        return match ($property?->owner_type) {
            Landlord::class => Landlord::with('user')->find($property->owner_id)?->user,
            Agency::class   => Agency::with('owner')->find($property->owner_id)?->owner,
            default         => null,
        };
    }

    /** Tell the property's manager something happened on a job (never fails the request). */
    public static function notifyManager(MaintenanceRequest $request, Notification $notification): void
    {
        try {
            self::managerOf($request)?->notify($notification);
        } catch (\Throwable $e) {
            report($e);
        }
    }

    public static function manualReference(): string
    {
        return 'PB_EFT_' . strtoupper(Str::random(10));
    }
}
