@php
    $isMonthly = $statement['from']->isSameMonth($statement['to']) && $statement['from']->day === 1;
    $periodLabel = $isMonthly
        ? $statement['from']->format('F Y')
        : $statement['from']->format('d M Y') . ' – ' . $statement['to']->format('d M Y');
    $propertyName = $propertyName ?? null;
    $rangeLabel = $rangeLabel ?? null;
    $title = ($isMonthly ? 'Monthly owner statement ' : 'Owner statement ') . $periodLabel . ($propertyName ? ' · ' . $propertyName : '');
    $docMeta = '<strong>OWNER STATEMENT</strong><br>' . e($periodLabel) . ($propertyName ? '<br>' . e($propertyName) : '');
    $money = fn ($n) => 'R ' . number_format((float) $n, 2, '.', ' ');
    $signed = fn ($n) => ($n < -0.004 ? '- ' : '') . $money(abs($n));
@endphp

<x-pdf-layout :title="$title" :docMeta="$docMeta">

<h1>{{ $isMonthly ? 'Monthly Owner Statement' : 'Owner Statement' }}</h1>
<p class="subtitle">{{ $rangeLabel ? $rangeLabel . ' · ' : '' }}{{ $periodLabel }} · rent received less maintenance · generated {{ now()->format('d M Y') }}</p>

<table class="kv">
    <tr><th>Landlord</th><td>{{ $landlordName }}</td></tr>
    <tr><th>Email</th><td>{{ $landlordEmail }}</td></tr>
    @if ($propertyName)
        <tr><th>Property</th><td>{{ $propertyName }}</td></tr>
    @else
        <tr><th>Properties</th><td>All properties ({{ $propertyCount }})</td></tr>
    @endif
</table>

<div class="box" style="margin-top: 14px;">
    <table>
        <tr>
            <td><span class="muted small">Rental income received</span><br><strong>{{ $money($statement['income']) }}</strong></td>
            <td><span class="muted small">Less: maintenance</span><br><strong>{{ $money($statement['maintenance']) }}</strong></td>
            <td class="right"><span class="muted small">Net to landlord</span><br>
                <strong style="font-size: 14px;">{{ $signed($statement['net']) }}</strong></td>
        </tr>
    </table>
</div>

@if (! $propertyName && (count($statement['by_property']) > 1 || ! $isMonthly))
    <h2>By property</h2>
    <table class="lines">
        <thead>
            <tr>
                <th>Property</th>
                <th class="right" style="width: 90px;">Income</th>
                <th class="right" style="width: 90px;">Maintenance</th>
                <th class="right" style="width: 90px;">Net</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($statement['by_property'] as $row)
                <tr>
                    <td>{{ $row['property'] }}</td>
                    <td class="right mono small" style="white-space: nowrap;">{{ $money($row['income']) }}</td>
                    <td class="right mono small" style="white-space: nowrap;">{{ $money($row['maintenance']) }}</td>
                    <td class="right mono small bold" style="white-space: nowrap;">{{ $signed($row['net']) }}</td>
                </tr>
            @empty
                <tr><td colspan="4" class="muted center">No activity in this period.</td></tr>
            @endforelse
        </tbody>
    </table>
@endif

<h2>Transactions</h2>
<table class="lines">
    <thead>
        <tr>
            <th style="width: 70px;">Date</th>
            <th>Description</th>
            <th style="width: 82px;">Reference</th>
            <th class="right" style="width: 72px;">Income</th>
            <th class="right" style="width: 72px;">Maintenance</th>
            <th class="right" style="width: 76px;">Running net</th>
        </tr>
    </thead>
    <tbody>
        @forelse ($statement['lines'] as $line)
            <tr>
                <td class="small" style="white-space: nowrap;">{{ $line['date']->format('d M Y') }}</td>
                <td>{{ $line['description'] }}<br><span class="muted small">{{ $line['property'] }}</span></td>
                <td class="mono small" style="white-space: nowrap; font-size: 8.5px;">{{ $line['reference'] }}</td>
                <td class="right mono small" style="white-space: nowrap;">{{ $line['income'] > 0 ? $money($line['income']) : '' }}</td>
                <td class="right mono small" style="white-space: nowrap;">{{ $line['expense'] > 0 ? $money($line['expense']) : '' }}</td>
                <td class="right mono small" style="white-space: nowrap;">{{ $signed($line['net']) }}</td>
            </tr>
        @empty
            <tr><td colspan="6" class="muted center">No rent received or maintenance paid in this period.</td></tr>
        @endforelse
    </tbody>
    <tfoot>
        <tr>
            <td colspan="3" class="bold">Net to landlord</td>
            <td class="right mono small" style="white-space: nowrap;">{{ $money($statement['income']) }}</td>
            <td class="right mono small" style="white-space: nowrap;">{{ $money($statement['maintenance']) }}</td>
            <td class="right mono bold" style="white-space: nowrap;">{{ $signed($statement['net']) }}</td>
        </tr>
    </tfoot>
</table>

<div class="muted small" style="margin-top: 24px; padding-top: 10px; border-top: 1px solid #E5E7EB;">
    Cash basis: income is rent actually received (by payment date); maintenance is contractor invoices paid in the period.
    Rent outstanding and unpaid invoices are not included until settled.
</div>

</x-pdf-layout>
