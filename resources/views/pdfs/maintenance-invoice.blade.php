@php
    $title = "Invoice INV-" . str_pad($invoice->id, 6, '0', STR_PAD_LEFT);
    $docMeta = '<strong>INVOICE</strong><br>INV-' . str_pad($invoice->id, 6, '0', STR_PAD_LEFT);
    $statusBadge = match ($invoice->status) {
        'paid'      => '<span class="badge badge-success">PAID</span>',
        'approved'  => '<span class="badge badge-warning">APPROVED</span>',
        'submitted' => '<span class="badge badge-ink">SUBMITTED</span>',
        'rejected'  => '<span class="badge badge-danger">REJECTED</span>',
        default     => '<span class="badge badge-ink">' . strtoupper($invoice->status) . '</span>',
    };
@endphp

<x-pdf-layout :title="$title" :docMeta="$docMeta">

<h1>Tax Invoice</h1>
<p class="subtitle">
    Maintenance work invoice · {!! $statusBadge !!}
</p>

<table class="grid-2">
    <tr>
        <td class="left">
            <h3>From (Contractor)</h3>
            <table class="kv">
                <tr><th>Business</th><td><strong>{{ $contractor->business_name ?? $contractor->user->name }}</strong></td></tr>
                <tr><th>Contact</th><td>{{ $contractor->user->name }}</td></tr>
                <tr><th>Email</th><td>{{ $contractor->user->email }}</td></tr>
                @if ($contractor->vat_registered)
                    <tr><th>VAT no.</th><td class="mono">{{ $contractor->vat_number ?? '—' }}</td></tr>
                @endif
                @if ($contractor->cipc_number)
                    <tr><th>CIPC no.</th><td class="mono">{{ $contractor->cipc_number }}</td></tr>
                @endif
            </table>
        </td>
        <td class="right">
            <h3>For (Billed to)</h3>
            <table class="kv">
                <tr><th>Property</th><td>{{ $property->address ?? $property->title }}</td></tr>
                <tr><th>Suburb</th><td>{{ $property->suburb }}, {{ $property->city }}</td></tr>
                <tr><th>Managing</th><td>{{ $billedTo }}</td></tr>
                <tr><th>Job ref</th><td class="mono">REQ-{{ str_pad($request->id, 6, '0', STR_PAD_LEFT) }}</td></tr>
                <tr><th>Job title</th><td>{{ $request->title }}</td></tr>
            </table>
        </td>
    </tr>
</table>

<h2>Line Items</h2>
<table class="lines">
    <thead>
        <tr>
            <th>Description</th>
            <th style="width: 70px;" class="right">Qty</th>
            <th style="width: 110px;" class="right">Unit (R)</th>
            <th style="width: 110px;" class="right">Subtotal (R)</th>
        </tr>
    </thead>
    <tbody>
        @foreach ($invoice->line_items ?? [] as $line)
            @php
                $qty = (float) ($line['qty'] ?? 1);
                $unit = (float) ($line['unit'] ?? 0);
                $sub = $qty * $unit;
            @endphp
            <tr>
                <td>{{ $line['desc'] ?? 'Line item' }}</td>
                <td class="right mono">{{ rtrim(rtrim(number_format($qty, 2), '0'), '.') }}</td>
                <td class="right mono">{{ number_format($unit, 2) }}</td>
                <td class="right mono">{{ number_format($sub, 2) }}</td>
            </tr>
        @endforeach
    </tbody>
    <tfoot>
        <tr>
            <td colspan="3" class="right">Subtotal</td>
            <td class="right mono">R {{ number_format($invoice->invoice_subtotal, 2) }}</td>
        </tr>
        @if ($invoice->vat_amount > 0)
            <tr>
                <td colspan="3" class="right">VAT (15%)</td>
                <td class="right mono">R {{ number_format($invoice->vat_amount, 2) }}</td>
            </tr>
        @endif
        <tr>
            <td colspan="3" class="right" style="font-size: 13px;">Total</td>
            <td class="right mono" style="font-size: 13px;">R {{ number_format($invoice->invoice_total, 2) }}</td>
        </tr>
    </tfoot>
</table>

@if ($invoice->original_quote_total > 0 && abs($invoice->deviation_amount) > 0.01)
    <div class="box">
        <strong>Variance vs original quote:</strong>
        Original quote was R {{ number_format($invoice->original_quote_total, 2) }} —
        invoice is
        <span style="color: {{ $invoice->deviation_amount > 0 ? '#991B1B' : '#047857' }}; font-weight: bold;">
            {{ $invoice->deviation_amount > 0 ? '+' : '-' }}R {{ number_format(abs($invoice->deviation_amount), 2) }}
        </span>
        ({{ $invoice->deviation_amount > 0 ? 'over' : 'under' }}).
        @if ($invoice->deviation_notes)
            <br><span class="muted">{{ $invoice->deviation_notes }}</span>
        @endif
    </div>
@endif

<h2>Payment Status</h2>
<table class="kv">
    <tr><th>Submitted</th><td>{{ $invoice->submitted_at?->format('d M Y') ?? '—' }}</td></tr>
    @if ($invoice->approved_at)
        <tr><th>Approved</th><td>{{ $invoice->approved_at->format('d M Y') }}</td></tr>
    @endif
    @if ($invoice->paid_at)
        <tr><th>Paid</th><td><strong>{{ $invoice->paid_at->format('d M Y') }}</strong></td></tr>
        <tr><th>Paystack ref</th><td class="mono small">{{ $invoice->paystack_reference ?? '—' }}</td></tr>
    @endif
</table>

<div class="muted small" style="margin-top: 28px; padding-top: 12px; border-top: 1px solid #E5E7EB;">
    Banking details and payment terms are managed by Property Basket's contractor payout system.
    A 2.5% platform fee is deducted from approved invoices on payout.
    Queries: <a href="mailto:support@propertybasket.co.za">support@propertybasket.co.za</a>
</div>

</x-pdf-layout>
