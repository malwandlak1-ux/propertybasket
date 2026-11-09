<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A version of one of the agency's standard documents. Exactly one version
 * per category is current; older ones stay as history.
 *
 * Only the lease agreement ever reaches tenants (to sign). Listing packs are
 * for the agency and its agents to share with prospects.
 */
class AgencyDocument extends Model
{
    public const CATEGORIES = [
        'lease_agreement' => [
            'label' => 'Lease agreement',
            'hint' => 'Your standard residential lease. Tenants see the current version on their dashboard and sign it electronically. PDF only.',
            'mimes' => 'pdf',
            'shareable' => false,
        ],
        'rental_pack' => [
            'label' => 'Rental listing pack',
            'hint' => 'Mandate, landlord forms and anything agents send owners when listing a rental.',
            'mimes' => 'pdf,doc,docx,xls,xlsx,ppt,pptx,zip,jpg,jpeg,png',
            'shareable' => true,
        ],
        'sale_pack' => [
            'label' => 'Sale listing pack',
            'hint' => 'Sole/open mandate, disclosure forms and anything agents send sellers.',
            'mimes' => 'pdf,doc,docx,xls,xlsx,ppt,pptx,zip,jpg,jpeg,png',
            'shareable' => true,
        ],
    ];

    protected $fillable = [
        'agency_id', 'category', 'version', 'is_current', 'path', 'original_name', 'mime', 'size', 'sha256', 'notes', 'uploaded_by',
    ];

    protected function casts(): array
    {
        return ['is_current' => 'boolean', 'version' => 'integer', 'size' => 'integer'];
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public static function currentFor(int $agencyId, string $category): ?self
    {
        return self::where('agency_id', $agencyId)->where('category', $category)->where('is_current', true)->latest('version')->first();
    }

    /** A download name like "Basket-Realty-Lease-agreement-v3.pdf". */
    public function downloadName(): string
    {
        $ext = strtolower(pathinfo($this->original_name, PATHINFO_EXTENSION)) ?: 'pdf';
        $label = self::CATEGORIES[$this->category]['label'] ?? 'Document';

        return \Illuminate\Support\Str::slug(($this->agency?->name ?? 'agency') . ' ' . $label) . "-v{$this->version}.{$ext}";
    }
}
