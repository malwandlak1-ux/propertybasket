<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\EnsuresSuperAdmin;
use App\Models\BankLink;
use App\Notifications\BankLinkStatusChanged;
use App\Services\Banking\H2H\BankLinkException;
use App\Services\Banking\H2H\H2hPayouts;
use App\Services\Banking\H2H\TransportFactory;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Platform admin: onboard agencies' host-to-host bank links (stages, SFTP details, tests). */
class BankLinksController extends Controller
{
    use EnsuresSuperAdmin;

    public function index(Request $request): Response
    {
        $this->ensureSuperAdmin($request);

        $links = BankLink::with(['agency:id,name,trust_bank,trust_account_number,trust_verified_at', 'files' => fn ($q) => $q->latest('id')])
            ->orderByRaw("CASE status WHEN 'requested' THEN 1 WHEN 'agreement' THEN 2 WHEN 'credentials' THEN 3 WHEN 'testing' THEN 4 WHEN 'live' THEN 5 ELSE 6 END")
            ->get()
            ->map(fn (BankLink $l) => [
                'id'             => $l->id,
                'agency'         => $l->agency?->name,
                'bank'           => $l->bankName(),
                'status'         => $l->status,
                'trust'          => $l->agency?->trust_account_number ? ($l->agency->trust_bank . ' •••• ' . substr(preg_replace('/\D/', '', $l->agency->trust_account_number), -4)) : null,
                'trust_verified' => (bool) $l->agency?->trust_verified_at,
                'contact'        => collect([$l->contact_name, $l->contact_email, $l->contact_phone])->filter()->implode(' · '),
                'banker_name'    => $l->banker_name,
                'banker_email'   => $l->banker_email,
                'notes'          => $l->notes,
                'client_code'    => $l->client_code,
                'sftp_host'      => $l->sftp_host,
                'sftp_port'      => $l->sftp_port,
                'sftp_username'  => $l->sftp_username,
                'has_password'   => filled($l->sftp_password),
                'has_key'        => filled($l->sftp_private_key),
                'upload_dir'     => $l->upload_dir,
                'download_dir'   => $l->download_dir,
                'requested_at'   => $l->requested_at?->format('d M Y'),
                'live_at'        => $l->live_at?->format('d M Y'),
                'last_polled_at' => $l->last_polled_at?->format('d M Y H:i'),
                'last_error'     => $l->last_error,
                'files'          => $l->files->take(8)->map(fn ($f) => ['id' => $f->id, 'direction' => $f->direction, 'name' => $f->name, 'summary' => $f->summary, 'at' => $f->created_at?->format('d M H:i')])->values(),
            ]);

        return Inertia::render('Admin/BankLinks', ['counts' => $this->sidebarCounts(), 'links' => $links]);
    }

    /** PATCH /admin/bank-links/{link} — stage + connection details (secrets only replaced when typed). */
    public function update(Request $request, BankLink $link): RedirectResponse
    {
        $this->ensureSuperAdmin($request);
        $data = $request->validate([
            'status'           => ['required', Rule::in(BankLink::STAGES)],
            'client_code'      => ['nullable', 'string', 'max:40'],
            'banker_name'      => ['nullable', 'string', 'max:120'],
            'banker_email'     => ['nullable', 'email', 'max:180'],
            'notes'            => ['nullable', 'string', 'max:2000'],
            'sftp_host'        => ['nullable', 'string', 'max:190'],
            'sftp_port'        => ['nullable', 'integer', 'min:1', 'max:65535'],
            'sftp_username'    => ['nullable', 'string', 'max:120'],
            'sftp_password'    => ['nullable', 'string', 'max:500'],
            'sftp_private_key' => ['nullable', 'string', 'max:20000'],
            'upload_dir'       => ['nullable', 'string', 'max:190'],
            'download_dir'     => ['nullable', 'string', 'max:190'],
        ]);
        foreach (['sftp_password', 'sftp_private_key'] as $secret) {
            if (blank($data[$secret] ?? null)) {
                unset($data[$secret]);
            }
        }
        $data['sftp_port'] = $data['sftp_port'] ?? 22;
        $data['upload_dir'] = ($data['upload_dir'] ?? null) ?: '/outbox';
        $data['download_dir'] = ($data['download_dir'] ?? null) ?: '/inbox';

        $link->fill($data);
        if (in_array($link->status, ['testing', 'live'], true) && ! $link->canSend()) {
            return back()->with('error', 'Add the SFTP host, username and a password or key before moving to ' . $link->status . '.');
        }
        $stageChanged = $link->isDirty('status');
        if ($stageChanged && $link->status === 'live') {
            $link->live_at = now();
        }
        $link->save();

        if ($stageChanged) {
            try {
                $link->agency?->owner?->notify(new BankLinkStatusChanged($link));
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return back()->with('success', ($link->agency?->name ?? 'Agency') . ': bank link saved' . ($stageChanged ? " (now {$link->status})" : '') . '.');
    }

    /** POST /admin/bank-links/{link}/test — log in to the bank's SFTP and list the download folder. */
    public function test(Request $request, BankLink $link, TransportFactory $transports): RedirectResponse
    {
        $this->ensureSuperAdmin($request);
        try {
            $files = $transports->for($link)->list();
        } catch (BankLinkException $e) {
            $link->update(['last_error' => mb_substr($e->getMessage(), 0, 300)]);

            return back()->with('error', 'Connection test failed: ' . $e->getMessage());
        }
        $link->update(['last_error' => null]);

        return back()->with('success', 'Connected to ' . $link->sftp_host . ': ' . count($files) . ' file(s) waiting in ' . $link->download_dir . '.');
    }

    /** POST /admin/bank-links/{link}/poll — read status files now instead of waiting for the schedule. */
    public function poll(Request $request, BankLink $link, H2hPayouts $payouts): RedirectResponse
    {
        $this->ensureSuperAdmin($request);
        try {
            $n = $payouts->poll($link);
        } catch (BankLinkException $e) {
            return back()->with('error', 'Could not read status files: ' . $e->getMessage());
        }

        return back()->with('success', "Read {$n} new file(s) from the bank.");
    }
}
