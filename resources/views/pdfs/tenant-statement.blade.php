@php
    $isMonthly = $statement['from']->isSameMonth($statement['to']) && $statement['from']->day === 1;
    $periodLabel = $isMonthly
        ? $statement['from']->format('F Y')
        : $statement['from']->format('d M Y') . ' – ' . $statement['to']->format('d M Y');
    $title = ($isMonthly ? 'Monthly statement ' : 'Account statement ') . $periodLabel;
    $docMeta = '<strong>STATEMENT</strong><br>' . e($periodLabel) . '<br>Lease ' . str_pad($lease->id, 6, '0', STR_PAD_LEFT);
    $money = fn ($n) => 'R ' . number_format((float) $n, 2, '.', ' ');
    $balance = fn ($n) => $n > 0.004 ? $money($n) . ' owing' : ($n < -0.004 ? $money(abs($n)) . ' credit' : 'R 0.00');
@endphp

<x-pdf-layout :title="$title" :docMeta="$docMeta">

<h1>{{ $isMonthly ? 'Monthly Rent Statement' : 'Rent Account Statement' }}</h1>
<p class="subtitle">{{ $periodLabel }} · generated {{ now()->format('d M Y') }}</p>

<table class="grid-2">
    <tr>
        <td class="left">
            <h3>Tenant</h3>
            <table class="kv">
                <tr><th>Name</th><td>{{ $tenant?->name ?? '—' }}</td></tr>
                <tr><th>Email</th><td>{{ $tenant?->email ?? '—' }}</td></tr>
                <tr><th>Lease #</th><td class="mono">{{ str_pad($lease->id, 6, '0', STR_PAD_LEFT) }}</td></tr>
            </table>
        </td>
        <td class="right">
            <h3>Property</h3>
            <table class="kv">
                <tr><th>Address</th><td>{{ $listing?->address ?? $listing?->title ?? '—' }}</td></tr>
                <tr><th>Suburb</th><td>{{ trim(($listing?->suburb ?? '') . ', ' . ($listing?->city ?? ''), ', ') }}</td></tr>
                <tr><th>{{ $agencyName ? 'Managed by' : 'Landlord' }}</th><td>{{ $agencyName ?? $landlordName ?? '—' }}</td></tr>
            </table>
        </td>
    </tr>
</table>

<div class="box" style="margin-top: 14px;">
    <table>
        <tr>
            <td><span class="muted small">Opening balance</span><br><strong>{{ $balance($statement['opening']) }}</strong></td>
            <td><span class="muted small">Rent charged</span><br><strong>{{ $money($statement['charged']) }}</strong></td>
            <td><span class="muted small">Payments received</span><br><strong>{{ $money($statement['paid']) }}</strong></td>
            <td class="right"><span class="muted small">Closing balance</span><br>
                <strong style="font-size: 14px;">{{ $balance($statement['closing']) }}</strong></td>
        </tr>
    </table>
</div>

<h2>Transactions</h2>
<table class="lines">
    <thead>
        <tr>
            <th style="width: 70px;">Date</th>
            <th>Description</th>
            <th style="width: 82px;">Reference</th>
            <th class="right" style="width: 72px;">Charge</th>
            <th class="right" style="width: 72px;">Payment</th>
            <th class="right" style="width: 76px;">Balance</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td class="small" style="white-space: nowrap;">{{ $statement['from']->format('d M Y') }}</td>
            <td class="muted">Opening balance</td>
            <td></td><td></td><td></td>
            <td class="right mono small" style="white-space: nowrap;">{{ $money($statement['opening']) }}</td>
        </tr>
        @forelse ($statement['lines'] as $line)
            <tr>
                <td class="small" style="white-space: nowrap;">{{ $line['date']->format('d M Y') }}</td>
                <td>{{ $line['description'] }}</td>
                <td class="mono small" style="white-space: nowrap; font-size: 8.5px;">{{ $line['reference'] }}</td>
                <td class="right mono small" style="white-space: nowrap;">{{ $line['charge'] > 0 ? $money($line['charge']) : '' }}</td>
                <td class="right mono small" style="white-space: nowrap;">{{ $line['payment'] > 0 ? $money($line['payment']) : '' }}</td>
                <td class="right mono small" style="white-space: nowrap;">{{ $money($line['balance']) }}</td>
            </tr>
        @empty
            <tr><td colspan="6" class="muted center">No transactions in this period.</td></tr>
        @endforelse
    </tbody>
    <tfoot>
        <tr>
            <td colspan="3" class="bold">Closing balance</td>
            <td class="right mono small">{{ $money($statement['charged']) }}</td>
            <td class="right mono small">{{ $money($statement['paid']) }}</td>
            <td class="right mono bold">{{ $money($statement['closing']) }}</td>
        </tr>
    </tfoot>
</table>

@if (! $isMonthly && $deposit)
    <h2>Deposit</h2>
    <table class="kv">
        <tr><th>Deposit</th><td>{{ $money($deposit->amount_deposited) }}</td></tr>
        <tr><th>Received</th><td>{{ $deposit->deposited_at?->format('d M Y') ?? 'Not yet received' }}</td></tr>
        <tr><th>Status</th><td>{{ ucfirst(str_replace('_', ' ', $deposit->status)) }}</td></tr>
        <tr><th>Interest accrued</th><td>{{ $money($deposit->accrued_interest) }} ({{ number_format((float) $deposit->interest_rate, 2) }}% p.a.)</td></tr>
    </table>
@endif

<div class="muted small" style="margin-top: 24px; padding-top: 10px; border-top: 1px solid #E5E7EB;">
    Balance: a positive figure means rent owing; "credit" means paid in advance. Rent is due on the 1st of each month.
    Queries about this statement: contact {{ $agencyName ?? $landlordName ?? 'your landlord' }} via the Messages tab in your tenant portal.
</div>

</x-pdf-layout>
