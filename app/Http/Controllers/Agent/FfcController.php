<?php

namespace App\Http\Controllers\Agent;

use App\Http\Controllers\Agent\Concerns\ResolvesAgent;
use App\Http\Controllers\Controller;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FfcController extends Controller
{
    use ResolvesAgent;

    /**
     * GET /agent/ffc — upload form + status banner.
     */
    public function index(Request $request): Response
    {
        $user  = $request->user();
        $pivot = $this->resolveAgentRecord($request);
        $now   = CarbonImmutable::now()->startOfDay();

        $daysLeft = $pivot->ffc_expires_at
            ? (int) round($now->diffInDays($pivot->ffc_expires_at->startOfDay(), false))
            : null;

        $state = match (true) {
            empty($pivot->ffc_number) || ! $pivot->ffc_expires_at => 'missing',
            $daysLeft !== null && $daysLeft < 0                   => 'expired',
            $daysLeft !== null && $daysLeft <= 30                 => 'expiring',
            default                                                => 'valid',
        };

        return Inertia::render('Agent/FfcCompliance', [
            'agent' => ['id' => $user->id, 'name' => $user->name, 'agency_name' => $pivot->agency->name],
            'ffc'   => [
                'state'                 => $state,
                'days_left'             => $daysLeft,
                'ffc_number'            => $pivot->ffc_number,
                'ffc_expires_at'        => $pivot->ffc_expires_at?->format('Y-m-d'),
                'has_certificate'       => ! empty($pivot->ffc_certificate_path),
                'certificate_url'       => ! empty($pivot->ffc_certificate_path)
                    ? route('agent.ffc.certificate')
                    : null,
                'last_reminder_sent_at' => $pivot->ffc_reminder_sent_at?->format('d M Y · H:i'),
            ],
        ]);
    }

    /**
     * POST /agent/ffc — upload / update certificate details.
     */
    public function update(Request $request): RedirectResponse
    {
        $pivot = $this->resolveAgentRecord($request);

        $data = $request->validate([
            'ffc_number'      => ['required', 'string', 'max:60'],
            'ffc_expires_at'  => ['required', 'date', 'after:today'],
            'ffc_certificate' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
        ]);

        $updates = [
            'ffc_number'     => $data['ffc_number'],
            'ffc_expires_at' => $data['ffc_expires_at'],
        ];

        if ($request->hasFile('ffc_certificate')) {
            // Replace existing — agents only need one current cert on file.
            if (! empty($pivot->ffc_certificate_path)) {
                Storage::disk('local')->delete($pivot->ffc_certificate_path);
            }
            $updates['ffc_certificate_path'] = $request->file('ffc_certificate')->store(
                "ffc/agent-{$pivot->user_id}",
                'local',
            );
        }

        // Clear the reminder timestamp so a fresh expiry cycle will send a new notice.
        $updates['ffc_reminder_sent_at'] = null;

        $pivot->update($updates);

        return redirect()
            ->route('agent.ffc.index')
            ->with('success', 'FFC certificate updated.');
    }

    /**
     * GET /agent/ffc/certificate — stream the uploaded certificate back to the
     * agent themselves. Files are stored on the private disk so they're not
     * publicly addressable; this is the only way to view them.
     */
    public function certificate(Request $request): StreamedResponse
    {
        $pivot = $this->resolveAgentRecord($request);

        abort_if(empty($pivot->ffc_certificate_path), 404, 'No certificate on file.');
        abort_unless(Storage::disk('local')->exists($pivot->ffc_certificate_path), 404, 'Certificate file missing on disk.');

        return Storage::disk('local')->response($pivot->ffc_certificate_path);
    }
}
