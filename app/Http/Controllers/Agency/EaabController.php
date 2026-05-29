<?php

namespace App\Http\Controllers\Agency;

use App\Http\Controllers\Agency\Concerns\ResolvesAgency;
use App\Http\Controllers\Controller;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class EaabController extends Controller
{
    use ResolvesAgency;

    public function show(Request $request): Response
    {
        $agency = $this->resolveAgency($request);
        $now    = CarbonImmutable::now()->startOfDay();

        $daysLeft = $agency->eaab_ffc_expires_at
            ? (int) round($now->diffInDays($agency->eaab_ffc_expires_at->startOfDay(), false))
            : null;

        $state = match (true) {
            empty($agency->eaab_ffc_number) || ! $agency->eaab_ffc_expires_at => 'missing',
            $daysLeft !== null && $daysLeft < 0                               => 'expired',
            $daysLeft !== null && $daysLeft <= 30                             => 'expiring',
            default                                                            => 'valid',
        };

        return Inertia::render('Agency/Compliance', [
            'agency' => ['id' => $agency->id, 'name' => $agency->name],
            'ffc'    => [
                'state'                 => $state,
                'days_left'             => $daysLeft,
                'ffc_number'            => $agency->eaab_ffc_number,
                'ffc_expires_at'        => $agency->eaab_ffc_expires_at?->format('Y-m-d'),
                'has_certificate'       => ! empty($agency->eaab_ffc_certificate_path),
                'certificate_url'       => ! empty($agency->eaab_ffc_certificate_path)
                    ? route('agency.compliance.certificate')
                    : null,
                'last_reminder_sent_at' => $agency->eaab_reminder_sent_at?->format('d M Y · H:i'),
                'verified_at'           => $agency->eaab_verified_at?->format('d M Y'),
            ],
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $agency = $this->resolveAgency($request);

        $data = $request->validate([
            'eaab_ffc_number'     => ['required', 'string', 'max:60'],
            'eaab_ffc_expires_at' => ['required', 'date', 'after:today'],
            'eaab_ffc_certificate'=> ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
        ]);

        $updates = [
            'eaab_ffc_number'     => $data['eaab_ffc_number'],
            'eaab_ffc_expires_at' => $data['eaab_ffc_expires_at'],
        ];

        if ($request->hasFile('eaab_ffc_certificate')) {
            if (! empty($agency->eaab_ffc_certificate_path)) {
                Storage::disk('local')->delete($agency->eaab_ffc_certificate_path);
            }
            $updates['eaab_ffc_certificate_path'] = $request->file('eaab_ffc_certificate')->store(
                "ffc/agency-{$agency->id}",
                'local',
            );
        }

        // Fresh expiry cycle — clear the reminder flag so notifications fire again.
        $updates['eaab_reminder_sent_at'] = null;

        $agency->update($updates);

        return redirect()
            ->route('agency.compliance.show')
            ->with('success', 'Agency FFC certificate updated.');
    }

    public function certificate(Request $request): StreamedResponse
    {
        $agency = $this->resolveAgency($request);
        abort_if(empty($agency->eaab_ffc_certificate_path), 404, 'No certificate on file.');
        abort_unless(Storage::disk('local')->exists($agency->eaab_ffc_certificate_path), 404, 'Certificate file missing on disk.');

        return Storage::disk('local')->response($agency->eaab_ffc_certificate_path);
    }
}
