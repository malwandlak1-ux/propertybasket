<?php

namespace App\Http\Controllers\Public;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\RentalApplication;
use App\Models\User;
use App\Notifications\RentalApplicationSubmitted;
use App\Support\Edition;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The prospect's side: /apply/{token}. No account needed — the unguessable
 * token is the key. Answers save as they go; documents go to private storage.
 */
class RentalApplicationController extends Controller
{
    /** Allowed answer keys per section (anything else is dropped). */
    public const FIELDS = [
        'personal' => ['first_name', 'last_name', 'id_type', 'id_number', 'date_of_birth', 'nationality', 'email', 'phone', 'marital_status', 'adults', 'children', 'pets', 'pets_details'],
        'address' => ['current_address', 'residence_type', 'years_at_address', 'current_rent', 'landlord_name', 'landlord_phone', 'reason_for_moving'],
        'employment' => ['employer', 'job_title', 'employer_phone', 'employment_start', 'business_name', 'business_reg', 'business_nature', 'years_trading', 'gross_income', 'net_income', 'other_income', 'monthly_debt'],
        'contact' => ['kin_name', 'kin_relationship', 'kin_phone'],
        'lease' => ['move_in_date', 'lease_term', 'vehicles', 'notes'],
        'consent' => ['credit_check', 'declaration', 'signature_name'],
    ];

    public function show(string $token): Response
    {
        $a = $this->find($token);
        if (! $a->opened_at) {
            $a->update(['opened_at' => now()]);
        }
        $a->load(['agency', 'listing', 'agent', 'documents']);
        $l = $a->listing;

        return Inertia::render('Public/Apply', [
            'token' => $a->token,
            'status' => $a->status,
            'editable' => $a->editable(),
            'step' => $a->step,
            'employment_type' => $a->employment_type,
            'data' => (object) ($a->data ?? []),
            'invitee' => ['name' => $a->invitee_name, 'email' => $a->invitee_email, 'phone' => $a->invitee_phone],
            'agency' => ['name' => $a->agency->name, 'logo' => $a->agency->logo ? Storage::disk('public')->url($a->agency->logo) : null, 'phone' => $a->agency->phone, 'email' => $a->agency->email],
            'agent' => $a->agent ? ['name' => $a->agent->name, 'phone' => $a->agent->phone, 'email' => $a->agent->email] : null,
            'listing' => $l ? [
                'title' => $l->title,
                'address' => trim(implode(', ', array_filter([$l->suburb, $l->city]))),
                'rent' => (float) $l->monthly_rent,
                'image' => $l->primary_image,
                'bedrooms' => $l->bedrooms !== null ? 0 + $l->bedrooms : null,
                'bathrooms' => $l->bathrooms !== null ? 0 + (float) $l->bathrooms : null,
            ] : null,
            'documents' => $a->documents->map(fn ($d) => ['id' => $d->id, 'kind' => $d->kind, 'name' => $d->original_name, 'size' => $d->size])->values(),
            'documentKinds' => RentalApplication::DOCUMENTS,
            'submitted_at' => $a->submitted_at?->timezone('Africa/Johannesburg')->format('d M Y, H:i'),
            'brand' => Edition::brand()['name'],
        ]);
    }

    /** Autosave one section of answers (and the step the applicant reached). */
    public function save(Request $request, string $token): RedirectResponse
    {
        $a = $this->editableOrFail($token);
        $v = $request->validate([
            'section' => ['nullable', Rule::in(array_keys(self::FIELDS))],
            'values' => ['nullable', 'array'],
            'values.*' => ['nullable'],
            'employment_type' => ['nullable', Rule::in(['salary', 'self_employed'])],
            'step' => ['nullable', 'integer', 'between:0,20'],
        ]);

        $data = $a->data ?? [];
        if (! empty($v['section'])) {
            $clean = [];
            foreach (self::FIELDS[$v['section']] as $k) {
                if (array_key_exists($k, $v['values'] ?? [])) {
                    $val = $v['values'][$k];
                    $clean[$k] = is_bool($val) ? $val : (is_scalar($val) ? mb_substr(trim((string) $val), 0, 1000) : null);
                }
            }
            $data[$v['section']] = array_merge($data[$v['section']] ?? [], $clean);
        }

        $a->update(array_filter([
            'data' => $data,
            'employment_type' => $v['employment_type'] ?? $a->employment_type,
            'step' => max($a->step, (int) ($v['step'] ?? 0)),
            'status' => 'in_progress',
        ], fn ($x) => $x !== null));

        return back();
    }

    public function upload(Request $request, string $token): RedirectResponse
    {
        $a = $this->editableOrFail($token);
        $request->validate([
            'kind' => ['required', Rule::in(array_keys(RentalApplication::DOCUMENTS))],
            'files' => ['required', 'array', 'max:6'],
            'files.*' => ['file', 'max:10240', 'mimes:pdf,jpg,jpeg,png,heic,heif,webp'],
        ], ['files.*.max' => 'Each file must be 10 MB or smaller.', 'files.*.mimes' => 'Upload PDF or photo files (JPG, PNG, HEIC).']);
        if ($a->documents()->count() + count($request->file('files')) > 30) {
            return back()->withErrors(['files' => 'That’s the maximum number of documents for one application.']);
        }

        foreach ($request->file('files') as $file) {
            $a->documents()->create([
                'kind' => $request->input('kind'),
                'path' => $file->store("rental-applications/{$a->id}", 'local'),
                'original_name' => mb_substr($file->getClientOriginalName(), 0, 200),
                'mime' => $file->getMimeType(),
                'size' => $file->getSize(),
            ]);
        }
        if ($a->status === 'invited') {
            $a->update(['status' => 'in_progress']);
        }

        return back();
    }

    public function removeDocument(string $token, int $document): RedirectResponse
    {
        $a = $this->editableOrFail($token);
        $doc = $a->documents()->findOrFail($document);
        Storage::disk('local')->delete($doc->path);
        $doc->delete();

        return back();
    }

    public function submit(Request $request, string $token): RedirectResponse
    {
        $a = $this->editableOrFail($token);
        $a->load('documents');
        $self = $a->employment_type === 'self_employed';

        $rules = [
            'employment_type' => ['required', Rule::in(['salary', 'self_employed'])],
            'personal.first_name' => ['required', 'string', 'max:80'],
            'personal.last_name' => ['required', 'string', 'max:80'],
            'personal.id_type' => ['required', Rule::in(['sa_id', 'passport'])],
            'personal.id_number' => ['required', 'string', 'max:40', ($a->data['personal']['id_type'] ?? 'sa_id') === 'sa_id' ? 'regex:/^\d{13}$/' : 'min:5'],
            'personal.email' => ['required', 'email', 'max:180'],
            'personal.phone' => ['required', 'string', 'regex:/^[+\d][\d\s()-]{8,}$/'],
            'personal.adults' => ['required', 'integer', 'between:1,20'],
            'personal.children' => ['nullable', 'integer', 'between:0,20'],
            'address.current_address' => ['required', 'string', 'max:500'],
            'address.residence_type' => ['required', Rule::in(['renting', 'own', 'family', 'other'])],
            'employment.gross_income' => ['required', 'numeric', 'min:0'],
            'employment.net_income' => ['required', 'numeric', 'min:0'],
            'contact.kin_name' => ['required', 'string', 'max:120'],
            'contact.kin_phone' => ['required', 'string', 'max:40'],
            'lease.move_in_date' => ['required', 'date'],
            'consent.credit_check' => ['accepted'],
            'consent.declaration' => ['accepted'],
            'consent.signature_name' => ['required', 'string', 'max:160'],
        ];
        $rules += $self
            ? ['employment.business_name' => ['required', 'string', 'max:160'], 'employment.years_trading' => ['required', 'numeric', 'min:0']]
            : ['employment.employer' => ['required', 'string', 'max:160'], 'employment.job_title' => ['required', 'string', 'max:120']];

        $input = ($a->data ?? []) + ['employment_type' => $a->employment_type];
        $validator = Validator::make($input, $rules, [
            'personal.id_number.regex' => 'A South African ID number has 13 digits.',
            'consent.credit_check.accepted' => 'Please allow the credit and reference check.',
            'consent.declaration.accepted' => 'Please confirm the information is true.',
        ], self::attributeNames());
        $missing = $a->missingDocuments();
        $validator->after(function ($v) use ($missing) {
            foreach ($missing as $k) {
                $v->errors()->add("documents.{$k}", 'Upload: ' . RentalApplication::DOCUMENTS[$k]['label']);
            }
        });
        if ($validator->fails()) {
            return back()->withErrors($validator);
        }

        $a->update(['status' => 'submitted', 'submitted_at' => now(), 'consent_ip' => $request->ip()]);

        // Tell the agent handling it, else the agency's admins.
        $recipients = $a->agent ? collect([$a->agent]) : User::where('role', Role::AgencyAdmin)->where('id', $a->agency->user_id)->get();
        foreach ($recipients as $user) {
            $href = $user->role === Role::Agent ? "/agent/tenants?tab=applications&application={$a->id}" : "/agency/tenants?tab=applications&application={$a->id}";
            try {
                $user->notify(new RentalApplicationSubmitted($a, $href));
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return back();
    }

    /** @return array<string, string> readable names for validation messages */
    public static function attributeNames(): array
    {
        return [
            'employment_type' => 'employment type', 'personal.first_name' => 'first name', 'personal.last_name' => 'surname',
            'personal.id_type' => 'ID type', 'personal.id_number' => 'ID or passport number', 'personal.email' => 'email', 'personal.phone' => 'mobile number',
            'personal.adults' => 'number of adults', 'address.current_address' => 'current address', 'address.residence_type' => 'current living arrangement',
            'employment.gross_income' => 'gross monthly income', 'employment.net_income' => 'net monthly income', 'employment.employer' => 'employer',
            'employment.job_title' => 'job title', 'employment.business_name' => 'business name', 'employment.years_trading' => 'years trading',
            'contact.kin_name' => 'emergency contact name', 'contact.kin_phone' => 'emergency contact number', 'lease.move_in_date' => 'move-in date',
            'consent.signature_name' => 'signature (full name)',
        ];
    }

    private function find(string $token): RentalApplication
    {
        abort_unless(preg_match('/^[A-Za-z0-9]{40}$/', $token), 404);

        return RentalApplication::where('token', $token)->firstOrFail();
    }

    private function editableOrFail(string $token): RentalApplication
    {
        $a = $this->find($token);
        if (! $a->editable()) {
            throw new \Illuminate\Http\Exceptions\HttpResponseException(back()->withErrors(['application' => 'This application has already been submitted, so it can’t be changed.']));
        }

        return $a;
    }
}
