{{-- Shared layout for all platform-generated PDFs --}}
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{{ $title ?? 'Property Basket Document' }}</title>
    <style>
        @page { margin: 28mm 18mm 22mm 18mm; }
        body { font-family: DejaVu Sans, sans-serif; color: #0B0B0F; font-size: 11px; line-height: 1.5; }
        header { position: fixed; top: -22mm; left: 0; right: 0; height: 18mm;
            border-bottom: 1.5px solid #5B3DF5; padding-bottom: 6px; }
        header .brand { color: #5B3DF5; font-weight: bold; font-size: 16px; }
        header .doc-meta { float: right; text-align: right; color: #6B7280; font-size: 10px; }
        footer { position: fixed; bottom: -16mm; left: 0; right: 0; height: 12mm;
            border-top: 1px solid #E5E7EB; padding-top: 6px;
            font-size: 9px; color: #9CA3AF; }
        footer .pager { float: right; }

        h1 { font-size: 22px; margin: 0 0 4px 0; color: #0B0B0F; }
        h2 { font-size: 14px; margin: 18px 0 8px 0; color: #0B0B0F;
            border-bottom: 1px solid #E5E7EB; padding-bottom: 4px; }
        h3 { font-size: 12px; margin: 14px 0 6px 0; color: #0B0B0F; }
        .subtitle { color: #6B7280; font-size: 11px; margin-bottom: 14px; }
        .muted { color: #6B7280; }
        .right { text-align: right; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .mono { font-family: DejaVu Sans Mono, monospace; }
        .small { font-size: 10px; }

        table { width: 100%; border-collapse: collapse; }
        table.kv th { text-align: left; color: #6B7280; font-weight: normal;
            font-size: 10px; padding: 4px 8px 4px 0; width: 36%; vertical-align: top; }
        table.kv td { padding: 4px 0; vertical-align: top; }

        table.lines { margin-top: 4px; }
        table.lines th { background: #F9FAFB; color: #6B7280; font-weight: 600;
            font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;
            padding: 8px; border-bottom: 1px solid #E5E7EB; text-align: left; }
        table.lines td { padding: 8px; border-bottom: 1px solid #F3F4F6; vertical-align: top; }
        table.lines tfoot td { border-top: 1px solid #E5E7EB; border-bottom: none;
            font-weight: bold; padding-top: 10px; }

        .badge { display: inline-block; padding: 2px 8px; border-radius: 999px;
            font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
        .badge-success { background: #D1FAE5; color: #047857; }
        .badge-warning { background: #FEF3C7; color: #92400E; }
        .badge-danger { background: #FEE2E2; color: #991B1B; }
        .badge-ink { background: #F3F4F6; color: #374151; }

        .box { border: 1px solid #E5E7EB; border-radius: 6px; padding: 12px;
            margin: 8px 0; background: #F9FAFB; }
        .grid-2 { width: 100%; }
        .grid-2 td { vertical-align: top; padding: 0; }
        .grid-2 td.left { padding-right: 16px; width: 50%; }
        .grid-2 td.right { padding-left: 16px; width: 50%; text-align: left; }

        .sig-block { margin-top: 28px; }
        .sig-line { border-top: 1px solid #0B0B0F; margin-top: 28px;
            padding-top: 4px; font-size: 10px; color: #6B7280; }
    </style>
</head>
<body>

<header>
    <span class="brand">Property Basket</span>
    <span class="doc-meta">
        @if (! empty($docMeta ?? null))
            {!! $docMeta !!}
        @endif
    </span>
</header>

<footer>
    Generated on {{ now()->format('d M Y \a\t H:i') }} · POPIA &amp; EAAB compliant · propertybasket.co.za
    <span class="pager">Page <script type="text/php">if(isset($pdf)){$pdf->page_text(530, 12, "{PAGE_NUM} of {PAGE_COUNT}", null, 8, [0.62,0.65,0.69]);}</script></span>
</footer>

<main>
    {!! $slot !!}
</main>

</body>
</html>
