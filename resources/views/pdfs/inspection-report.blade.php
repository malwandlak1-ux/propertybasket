@php
    $title = ucfirst(str_replace('_', '-', $inspection->type)) . ' Inspection · ' . ($listing->title ?? '—');
    $docMeta = '<strong>INSPECTION</strong><br>INS-' . str_pad($inspection->id, 6, '0', STR_PAD_LEFT);
    $rooms   = is_array($inspection->rooms) ? $inspection->rooms : [];
    $totalPhotos = collect($rooms)->sum(fn ($r) => is_array($r['photos'] ?? null) ? count($r['photos']) : 0);
    $typeLabel = match ($inspection->type) {
        'move_in'  => 'Move-In Inspection Report',
        'move_out' => 'Move-Out Inspection Report',
        'routine'  => 'Routine Inspection Report',
        default    => ucwords(str_replace('_', ' ', $inspection->type)) . ' Inspection',
    };
@endphp

<x-pdf-layout :title="$title" :docMeta="$docMeta">

<h1>{{ $typeLabel }}</h1>
<p class="subtitle">
    Conducted under the Rental Housing Act, 1999 · Sections 5(3)(e) &amp; 5(3)(f)
</p>

<table class="grid-2">
    <tr>
        <td class="left">
            <h3>Property</h3>
            <table class="kv">
                <tr><th>Address</th><td><strong>{{ $listing->address ?? $listing->title }}</strong></td></tr>
                <tr><th>Suburb</th><td>{{ $listing->suburb }}, {{ $listing->city }}</td></tr>
                <tr><th>Beds/baths</th><td>{{ $listing->bedrooms }} bed · {{ $listing->bathrooms }} bath</td></tr>
            </table>
        </td>
        <td class="right">
            <h3>Inspection</h3>
            <table class="kv">
                <tr><th>Type</th><td><strong>{{ ucwords(str_replace('_', ' ', $inspection->type)) }}</strong></td></tr>
                <tr><th>Status</th><td>{{ ucfirst($inspection->status) }}</td></tr>
                <tr>
                    <th>Conducted by</th>
                    <td>{{ $conductor->name ?? '—' }}</td>
                </tr>
                <tr>
                    <th>Rooms covered</th>
                    <td>{{ count($rooms) }} rooms · {{ $totalPhotos }} photos</td>
                </tr>
            </table>
        </td>
    </tr>
</table>

<h2>Room-by-Room Findings</h2>

@forelse ($rooms as $room)
    <div class="box" style="page-break-inside: avoid;">
        <table style="width: 100%;">
            <tr>
                <td style="font-weight: bold; font-size: 12px;">{{ $room['name'] ?? 'Room' }}</td>
                <td class="right small muted">
                    📸 {{ is_array($room['photos'] ?? null) ? count($room['photos']) : 0 }} photos captured
                </td>
            </tr>
        </table>

        @if (! empty($room['notes']))
            <p style="margin: 6px 0 0 0; font-size: 11px;">{{ $room['notes'] }}</p>
        @else
            <p class="muted small" style="margin: 6px 0 0 0;">No notes recorded.</p>
        @endif

        @if (! empty($room['photos']) && is_array($room['photos']))
            <table style="width: 100%; margin-top: 8px;">
                <tr>
                    @foreach (array_slice($room['photos'], 0, 4) as $photo)
                        <td style="width: 25%; padding: 4px; vertical-align: top;">
                            <div style="background: #F3F4F6; border: 1px dashed #D1D5DB; border-radius: 4px;
                                height: 50px; text-align: center; line-height: 50px; color: #9CA3AF; font-size: 9px;">
                                📷 {{ $photo['caption'] ?? 'Photo' }}
                            </div>
                        </td>
                    @endforeach
                </tr>
            </table>
        @endif
    </div>
@empty
    <p class="muted">No rooms were recorded for this inspection.</p>
@endforelse

@if ($inspection->deduction_total > 0)
    <h2>Deductions from Deposit</h2>
    <div class="box" style="background: #FEF3C7; border-color: #F59E0B;">
        <strong style="font-size: 13px;">Total deductions:</strong>
        <span class="mono" style="font-size: 14px; float: right;">R {{ number_format($inspection->deduction_total, 2) }}</span>
        <div style="clear: both; margin-top: 6px;" class="small">
            Itemised deductions are listed in the accompanying deposit refund statement.
        </div>
    </div>
@endif

<h2>Sign-Off</h2>
<table class="grid-2 sig-block">
    <tr>
        <td class="left">
            <div class="sig-line">
                @if ($inspection->tenant_signed_at)
                    Tenant: <strong>{{ $tenant->name ?? '—' }}</strong><br>
                    Signed: {{ $inspection->tenant_signed_at->format('d M Y \a\t H:i') }}<br>
                    <span class="small muted">Digital signature: {{ \Illuminate\Support\Str::limit($inspection->tenant_signature ?? '—', 24) }}</span>
                @else
                    Tenant signature: <span class="muted">— not yet signed —</span>
                @endif
            </div>
        </td>
        <td class="right">
            <div class="sig-line">
                @if ($inspection->agent_signed_at)
                    Inspector: <strong>{{ $conductor->name ?? '—' }}</strong><br>
                    Signed: {{ $inspection->agent_signed_at->format('d M Y \a\t H:i') }}<br>
                    <span class="small muted">Digital signature: {{ \Illuminate\Support\Str::limit($inspection->agent_signature ?? '—', 24) }}</span>
                @else
                    Inspector signature: <span class="muted">— not yet signed —</span>
                @endif
            </div>
        </td>
    </tr>
</table>

<div class="muted small" style="margin-top: 28px; padding-top: 12px; border-top: 1px solid #E5E7EB;">
    Photos referenced in this report are stored in the Property Basket cloud archive (POPIA compliant).
    This document is admissible as evidence in CCMA / Rental Housing Tribunal disputes.
</div>

</x-pdf-layout>
