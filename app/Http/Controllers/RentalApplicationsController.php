<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Agency\Concerns\ResolvesAgency;
use App\Models\Agency;
use App\Models\AgencyAgent;
use App\Models\Listing;
use App\Models\RentalApplication;
use App\Notifications\RentalApplicationDecision;
use App\Notifications\RentalApplicationLink;
use App\Services\TenantInviter;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Tenants → Applications (agent + agency). Agents see the applications they
 * handle; agency admins see every application in the agency.
 */
class RentalApplicationsController extends Controller
{
    use ResolvesAgency;

    /** Props for the Applications tab on the Tenants pages. */
    public static function props(Request $request): array
    {
        $self = new self;
        [$agency, $agentOnly] = $self->context($request);

        $apps = $self->scoped($request)->with(['listing:id,title,suburb,city,monthly_rent,primary_image,listing_type,status', 'agent:id,name', 'documents', 'lease:id,created_at'])
            ->latest()->orderByDesc('id')->limit(300)->get();

        $listings = Listing::query()
            ->where('listing_type', 'long_term_rent')
            ->whereIn('status', ['available', 'draft'])
            ->when($agentOnly,
                fn ($q) => $q->where('agent_id', $request->user()->id),
                fn ($q) => $q->where(fn ($w) => $w->where(fn ($o) => $o->where('owner_type', Agency::class)->where('owner_id', $agency->id))
                    ->orWhereIn('agent_id', AgencyAgent::where('agency_id', $agency->id)->pluck('user_id'))))
            ->orderBy('title')->limit(300)->get(['id', 'title', 'suburb', 'monthly_rent']);

        return [
            'applications' => $apps->map(fn (RentalApplication $a) => $self->row($a, $request))->values(),
            'applicationListings' => $listings->map(fn ($l) => ['id' => $l->id, 'label' => $l->title . ($l->suburb ? " · {$l->suburb}" : ''), 'rent' => (float) $l->monthly_rent])->values(),
            'documentKinds' => collect(RentalApplication::DOCUMENTS)->map(fn ($d) => $d['label']),
        ];
    }

    public function store(Request $request): RedirectResponse
    {
        [$agency, $agentOnly] = $this->context($request);
        $data = $request->validate([
            'listing_id' => ['required', 'integer'],
            'invitee_name' => ['nullable', 'string', 'max:120'],
            'invitee_email' => ['nullable', 'email', 'max:180'],
            'invitee_phone' => ['nullable', 'string', 'max:40'],
            'send_email' => ['boolean'],
        ]);
        $ids = collect(self::props($request)['applicationListings'])->pluck('id');
        if (! $ids->contains((int) $data['listing_id'])) {
            return back()->withErrors(['listing_id' => 'Choose one of your rental listings.']);
        }
        $listing = Listing::find($data['listing_id']);

        $a = RentalApplication::create([
            'agency_id' => $agency->id,
            'listing_id' => $listing->id,
            'agent_id' => $agentOnly ? $request->user()->id : ($listing->agent_id ?: null),
            'created_by' => $request->user()->id,
            'status' => 'invited',
            'invitee_name' => $data['invitee_name'] ?? null,
            'invitee_email' => $data['invitee_email'] ?? null,
            'invitee_phone' => $data['invitee_phone'] ?? null,
        ]);

        $msg = 'Application link created. Copy it or share it on WhatsApp.';
        if (($data['send_email'] ?? false) && $a->invitee_email) {
            $msg = $this->emailLink($a) ? "Application link created and emailed to {$a->invitee_email}." : 'Application link created, but the email could not be sent. Copy the link instead.';
        }

        return back()->with('success', $msg)->with('new_application_id', $a->id);
    }

    public function send(Request $request, RentalApplication $application): RedirectResponse
    {
        $this->authorizeFor($request, $application);
        if (! $application->invitee_email) {
            return back()->with('error', 'Add the applicant’s email first, or share the link on WhatsApp.');
        }

        return $this->emailLink($application)
            ? back()->with('success', "Link emailed to {$application->invitee_email}.")
            : back()->with('error', 'The email could not be sent. Copy the link instead.');
    }

    public function decide(Request $request, RentalApplication $application): RedirectResponse
    {
        $this->authorizeFor($request, $application);
        $data = $request->validate([
            'status' => ['required', Rule::in(['reviewing', 'approved', 'declined', 'in_progress'])],
            'note' => ['nullable', 'string', 'max:1000'],
            'notify' => ['boolean'],
        ]);
        if ($application->editable() && $data['status'] !== 'in_progress') {
            return back()->with('error', 'The applicant hasn’t submitted yet.');
        }

        $application->update([
            'status' => $data['status'],
            'decision_note' => $data['note'] ?? $application->decision_note,
            'decided_by' => in_array($data['status'], ['approved', 'declined'], true) ? $request->user()->id : $application->decided_by,
            'decided_at' => in_array($data['status'], ['approved', 'declined'], true) ? now() : $application->decided_at,
        ]);

        $msg = match ($data['status']) {
            'approved' => 'Application approved.',
            'declined' => 'Application declined.',
            'reviewing' => 'Marked as under review.',
            'in_progress' => 'Application reopened: the applicant can edit it again with the same link.',
        };
        if (($data['notify'] ?? false) && in_array($data['status'], ['approved', 'declined'], true) && ($email = $application->applicantEmail())) {
            try {
                Notification::route('mail', [$email => $application->applicantName()])->notify(new RentalApplicationDecision($application));
                $msg .= " {$application->applicantName()} was emailed.";
            } catch (\Throwable $e) {
                report($e);
                $msg .= ' The email to the applicant could not be sent.';
            }
        }

        return back()->with('success', $msg);
    }

    /**
     * Create the lease from an application: same as Invite Tenant on the
     * listing, pre-filled from the applicant's answers. Approves it too.
     */
    public function createLease(Request $request, RentalApplication $application): RedirectResponse
    {
        $this->authorizeFor($request, $application);
        $application->loadMissing(['listing', 'agent']);
        $listing = $application->listing;

        if ($application->lease_id) {
            return back()->with('error', 'A lease was already created from this application.');
        }
        if (! in_array($application->status, ['submitted', 'reviewing', 'approved'], true)) {
            return back()->with('error', $application->status === 'declined' ? 'This application was declined.' : 'The applicant hasn’t submitted yet.');
        }
        if (! $listing || $listing->listing_type !== 'long_term_rent') {
            return back()->with('error', 'This application has no rental listing to lease.');
        }
        if ($listing->status === 'leased') {
            return back()->with('error', 'This property is already leased. Reactivate the listing first if the previous lease has ended.');
        }

        $data = $request->validate([
            'tenant_name' => ['required', 'string', 'max:120'],
            'tenant_email' => ['required', 'email', 'max:180'],
            'tenant_phone' => ['nullable', 'string', 'max:30'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after:start_date'],
            'monthly_rent' => ['required', 'numeric', 'min:0'],
            'deposit_amount' => ['nullable', 'numeric', 'min:0'],
        ]);

        // The agent who handles the lease: the application's agent, else the
        // listing's agent (the one who earns the rental commission).
        $agent = $application->agent ?? ($listing->agent_id ? User::find($listing->agent_id) : null);
        $lease = app(TenantInviter::class)->invite($listing, $application->agency_id, $agent, $request->user(), $data);

        $application->update([
            'lease_id' => $lease->id,
            'status' => 'approved',
            'decided_by' => $application->decided_by ?? $request->user()->id,
            'decided_at' => $application->decided_at ?? now(),
        ]);

        return back()->with('success', "Lease created for {$data['tenant_name']}. They’ve been invited to the platform to sign it, and the listing is no longer public.");
    }

    public function destroy(Request $request, RentalApplication $application): RedirectResponse
    {
        $this->authorizeFor($request, $application);
        Storage::disk('local')->deleteDirectory("rental-applications/{$application->id}");
        $application->delete();

        return back()->with('success', 'Application deleted, with its documents.');
    }

    public function document(Request $request, RentalApplication $application, int $document): StreamedResponse
    {
        $this->authorizeFor($request, $application);
        $doc = $application->documents()->findOrFail($document);
        abort_unless(Storage::disk('local')->exists($doc->path), 404);

        $name = Str::ascii($doc->original_name) ?: 'document';

        return Storage::disk('local')->response($doc->path, $name, [
            'Content-Type' => $doc->mime ?: 'application/octet-stream',
            'X-Content-Type-Options' => 'nosniff',
        ], $request->boolean('download') ? 'attachment' : 'inline');
    }

    // ── helpers ─────────────────────────────────────────────────────────

    /** @return array{0: Agency, 1: bool} the agency, and whether to limit to the agent's own */
    private function context(Request $request): array
    {
        if ($request->routeIs('agency.*')) {
            return [$this->resolveAgency($request), false];
        }
        $record = AgencyAgent::where('user_id', $request->user()->id)->with('agency')->first();
        abort_unless($record, 403, 'You are not linked to an agency.');

        return [$record->agency, true];
    }

    private function scoped(Request $request): Builder
    {
        [$agency, $agentOnly] = $this->context($request);

        return RentalApplication::where('agency_id', $agency->id)
            ->when($agentOnly, fn ($q) => $q->where(fn ($w) => $w->where('agent_id', $request->user()->id)->orWhere('created_by', $request->user()->id)));
    }

    private function authorizeFor(Request $request, RentalApplication $application): void
    {
        abort_unless($this->scoped($request)->whereKey($application->id)->exists(), 404);
    }

    /** Pre-fill for "Create lease" from the applicant's answers. */
    private function leaseDefaults(RentalApplication $a, float $rent): array
    {
        $p = $a->data['personal'] ?? [];
        $l = $a->data['lease'] ?? [];
        try {
            $start = ! empty($l['move_in_date']) ? Carbon::parse($l['move_in_date']) : now()->addMonthNoOverflow()->startOfMonth();
        } catch (\Throwable) {
            $start = now()->addMonthNoOverflow()->startOfMonth();
        }
        if ($start->isPast()) {
            $start = now()->startOfDay();
        }
        $months = is_numeric($l['lease_term'] ?? null) ? (int) $l['lease_term'] : 12;

        return [
            'tenant_name' => $a->applicantName() !== 'New applicant' ? $a->applicantName() : '',
            'tenant_email' => (string) $a->applicantEmail(),
            'tenant_phone' => (string) (($p['phone'] ?? null) ?: $a->invitee_phone),
            'start_date' => $start->toDateString(),
            'end_date' => $start->copy()->addMonthsNoOverflow($months)->subDay()->toDateString(),
            'monthly_rent' => $rent ?: null,
            'deposit_amount' => $rent ?: null,
        ];
    }

    private function emailLink(RentalApplication $a): bool
    {
        try {
            Notification::route('mail', [$a->invitee_email => $a->invitee_name ?: $a->invitee_email])->notify(new RentalApplicationLink($a));

            return true;
        } catch (\Throwable $e) {
            report($e);

            return false;
        }
    }

    private function row(RentalApplication $a, Request $request): array
    {
        $base = $request->routeIs('agency.*') ? '/agency/tenants/applications' : '/agent/tenants/applications';
        $rent = (float) ($a->listing?->monthly_rent ?? 0);
        $income = $a->grossIncome();

        return [
            'id' => $a->id,
            'status' => $a->status,
            'name' => $a->applicantName(),
            'email' => $a->applicantEmail(),
            'phone' => ($a->data['personal']['phone'] ?? null) ?: $a->invitee_phone,
            'listing' => $a->listing ? ['id' => $a->listing->id, 'title' => $a->listing->title, 'suburb' => $a->listing->suburb, 'rent' => $rent] : null,
            'agent' => $a->agent?->name,
            'employment_type' => $a->employment_type,
            'income' => $income,
            'rent_to_income' => $income > 0 && $rent > 0 ? round($rent / $income * 100) : null,
            'url' => $a->url(),
            'created' => $a->created_at?->timezone('Africa/Johannesburg')->format('d M Y'),
            'opened' => $a->opened_at !== null,
            'submitted' => $a->submitted_at?->timezone('Africa/Johannesburg')->format('d M Y, H:i'),
            'decided' => $a->decided_at?->timezone('Africa/Johannesburg')->format('d M Y'),
            'note' => $a->decision_note,
            'data' => (object) ($a->data ?? []),
            'missing' => $a->editable() ? [] : $a->missingDocuments(),
            'documents' => $a->documents->map(fn ($d) => [
                'id' => $d->id, 'kind' => $d->kind, 'name' => $d->original_name, 'size' => $d->size,
                'url' => "{$base}/{$a->id}/documents/{$d->id}",
            ])->values(),
            'base' => "{$base}/{$a->id}",
            'lease' => $a->lease_id ? ['id' => $a->lease_id, 'created' => $a->lease?->created_at?->timezone('Africa/Johannesburg')->format('d M Y')] : null,
            'can_lease' => ! $a->lease_id && in_array($a->status, ['submitted', 'reviewing', 'approved'], true)
                && $a->listing && $a->listing->listing_type === 'long_term_rent' && $a->listing->status !== 'leased',
            'listing_leased' => $a->listing?->status === 'leased' && ! $a->lease_id,
            'lease_defaults' => $this->leaseDefaults($a, $rent),
        ];
    }
}
