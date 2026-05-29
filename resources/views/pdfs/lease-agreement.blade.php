@php
    $title = "Lease Agreement #" . str_pad($lease->id, 6, '0', STR_PAD_LEFT);
    $docMeta = '<strong>LEASE AGREEMENT</strong><br>LSE-' . str_pad($lease->id, 6, '0', STR_PAD_LEFT);
    $months  = \Carbon\Carbon::parse($lease->start_date)->diffInMonths(\Carbon\Carbon::parse($lease->end_date));
@endphp

<x-pdf-layout :title="$title" :docMeta="$docMeta">

<h1>Residential Lease Agreement</h1>
<p class="subtitle">
    Summary of lease terms (Section 5 of the Rental Housing Act, 1999) ·
    {{ ucfirst($lease->status) }}
</p>

<h2>Parties</h2>
<table class="grid-2">
    <tr>
        <td class="left">
            <h3>Landlord / Lessor</h3>
            <table class="kv">
                @if ($agencyName)
                    <tr><th>Managing agency</th><td><strong>{{ $agencyName }}</strong></td></tr>
                @endif
                @if ($landlordName)
                    <tr><th>Owner</th><td>{{ $landlordName }}</td></tr>
                @endif
                @if ($agentName)
                    <tr><th>Acting agent</th><td>{{ $agentName }}</td></tr>
                @endif
            </table>
        </td>
        <td class="right">
            <h3>Tenant / Lessee</h3>
            <table class="kv">
                <tr><th>Name</th><td><strong>{{ $tenant->name }}</strong></td></tr>
                <tr><th>Email</th><td>{{ $tenant->email }}</td></tr>
                @if ($tenant->phone)
                    <tr><th>Phone</th><td>{{ $tenant->phone }}</td></tr>
                @endif
            </table>
        </td>
    </tr>
</table>

<h2>Premises</h2>
<table class="kv">
    <tr><th>Address</th><td><strong>{{ $listing->address ?? $listing->title }}</strong></td></tr>
    <tr><th>Suburb</th><td>{{ $listing->suburb }}, {{ $listing->city }}, {{ $listing->province }}</td></tr>
    <tr><th>Type</th><td>{{ ucwords(str_replace('_', ' ', $listing->property_type)) }} · {{ $listing->bedrooms }} bed · {{ $listing->bathrooms }} bath · {{ $listing->area_sqm }}m²</td></tr>
</table>

<h2>Term &amp; Rent</h2>
<table class="kv">
    <tr><th>Lease starts</th><td><strong>{{ \Carbon\Carbon::parse($lease->start_date)->format('d F Y') }}</strong></td></tr>
    <tr><th>Lease ends</th><td><strong>{{ \Carbon\Carbon::parse($lease->end_date)->format('d F Y') }}</strong></td></tr>
    <tr><th>Duration</th><td>{{ $months }} months</td></tr>
    <tr><th>Monthly rent</th><td><strong>R {{ number_format($lease->monthly_rent, 2) }}</strong> payable on or before the 1st of each month</td></tr>
    <tr><th>Escalation</th><td>{{ rtrim(rtrim(number_format($lease->escalation_percent, 2), '0'), '.') }}% per annum (at renewal)</td></tr>
    <tr><th>Notice period</th><td>{{ $lease->notice_period_days }} days written notice required (either party)</td></tr>
</table>

<h2>Deposit (Section 32 Trust)</h2>
<table class="kv">
    <tr><th>Deposit amount</th><td><strong>R {{ number_format($lease->deposit_amount, 2) }}</strong></td></tr>
    <tr><th>Interest rate</th><td>{{ rtrim(rtrim(number_format($lease->deposit_interest_rate, 2), '0'), '.') }}% per annum</td></tr>
    <tr><th>Held in trust by</th><td>{{ $agencyName ?? $landlordName ?? 'Property Basket' }}</td></tr>
    <tr><th>Refund window</th><td>Within 14 days of move-out inspection, less any agreed deductions</td></tr>
</table>

<h2>Signatures &amp; Acceptance</h2>
<table class="grid-2 sig-block">
    <tr>
        <td class="left">
            <div class="sig-line">
                @if ($lease->signed_at)
                    Tenant: <strong>{{ $tenant->name }}</strong><br>
                    Signed: {{ $lease->signed_at?->format('d F Y') }}
                @else
                    Tenant signature: ___________________________<br>
                    Date: ____________
                @endif
            </div>
        </td>
        <td class="right">
            <div class="sig-line">
                @if ($lease->signed_at)
                    Landlord / Agent: <strong>{{ $agentName ?? $landlordName ?? $agencyName }}</strong><br>
                    Signed: {{ $lease->signed_at?->format('d F Y') }}
                @else
                    Landlord / Agent signature: ___________________________<br>
                    Date: ____________
                @endif
            </div>
        </td>
    </tr>
</table>

<div class="muted small" style="margin-top: 28px; padding-top: 12px; border-top: 1px solid #E5E7EB;">
    This is a summary document automatically generated from the lease record stored in Property Basket.
    The full lease agreement (containing all clauses, house rules, schedules, and addenda) was signed
    separately and remains the binding contract between parties. POPIA &amp; Rental Housing Act compliant.
</div>

</x-pdf-layout>
