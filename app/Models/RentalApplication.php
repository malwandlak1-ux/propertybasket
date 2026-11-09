<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * A prospect tenant's online rental application, reached through a private
 * link (/apply/{token}) that an agent or agency sends them.
 */
class RentalApplication extends Model
{
    public const STATUSES = ['invited', 'in_progress', 'submitted', 'reviewing', 'approved', 'declined'];

    /** Document kinds: label, hint, and which employment types must supply it. */
    public const DOCUMENTS = [
        'id_document' => ['label' => 'ID document or passport', 'hint' => 'Both sides of a smart ID card.', 'required' => ['salary', 'self_employed']],
        'payslip' => ['label' => 'Latest 3 months’ payslips', 'hint' => null, 'required' => ['salary']],
        'bank_statement' => ['label' => 'Bank statements', 'hint' => 'Salary earners: latest 3 months, stamped. Self-employed: latest 6 months.', 'required' => ['salary', 'self_employed']],
        'proof_of_residence' => ['label' => 'Proof of residence', 'hint' => 'Utility bill or lease, not older than 3 months.', 'required' => ['salary', 'self_employed']],
        'irp5' => ['label' => 'Latest IRP5', 'hint' => null, 'required' => []],
        'business_docs' => ['label' => 'Business documents', 'hint' => 'Company registration (CIPC) and latest financial statements or tax assessment (ITA34).', 'required' => ['self_employed']],
        'other' => ['label' => 'Anything else', 'hint' => 'Reference letter, co-applicant documents, etc.', 'required' => []],
    ];

    protected $fillable = [
        'token', 'agency_id', 'listing_id', 'agent_id', 'created_by', 'status', 'invitee_name', 'invitee_email', 'invitee_phone',
        'employment_type', 'data', 'step', 'opened_at', 'submitted_at', 'consent_ip', 'decided_by', 'decided_at', 'decision_note',
    ];

    protected function casts(): array
    {
        return [
            'data' => 'array',
            'step' => 'integer',
            'opened_at' => 'datetime',
            'submitted_at' => 'datetime',
            'decided_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $a) {
            $a->token ??= Str::random(40);
        });
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class);
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'agent_id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(RentalApplicationDocument::class);
    }

    public function url(): string
    {
        return url('/apply/' . $this->token);
    }

    /** The applicant can still change it. */
    public function editable(): bool
    {
        return in_array($this->status, ['invited', 'in_progress'], true);
    }

    public function applicantName(): string
    {
        $p = $this->data['personal'] ?? [];
        $name = trim(($p['first_name'] ?? '') . ' ' . ($p['last_name'] ?? ''));

        return $name !== '' ? $name : ($this->invitee_name ?: 'New applicant');
    }

    public function applicantEmail(): ?string
    {
        return ($this->data['personal']['email'] ?? null) ?: $this->invitee_email;
    }

    public function grossIncome(): float
    {
        $e = $this->data['employment'] ?? [];

        return (float) ($e['gross_income'] ?? 0) + (float) ($e['other_income'] ?? 0);
    }

    /** @return list<string> document kinds still missing for this employment type */
    public function missingDocuments(): array
    {
        $type = $this->employment_type ?? 'salary';
        $have = $this->documents->pluck('kind')->unique()->all();

        return array_values(array_filter(
            array_keys(self::DOCUMENTS),
            fn ($k) => in_array($type, self::DOCUMENTS[$k]['required'], true) && ! in_array($k, $have, true),
        ));
    }
}
