<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">

    @php($brand = \App\Support\Edition::brand())
    <title inertia>{{ $brand['name'] }}</title>

    {{-- Favicon — use the dark logo-icon PNG. Modern browsers happily use PNG
         in place of .ico, so we don't need to convert. The empty favicon.ico
         in /public is kept only so root requests don't 404. --}}
    @php($icon = $brand['icon'] ?: '/images/logo-icon.png')
    <link rel="icon" type="image/png" href="{{ $icon }}">
    <link rel="apple-touch-icon" sizes="180x180" href="{{ $icon }}">
    <link rel="shortcut icon" href="{{ $icon }}" type="image/png">

    {{-- Per-page SEO: server-rendered so social scrapers & search crawlers
         (which don't run our client JS) see OpenGraph, Twitter cards and
         JSON-LD. Populated via ->withViewData(['seo' => ...]) on pages that
         need it (currently the /advice article page). --}}
    @isset($seo)
        <meta name="description" content="{{ $seo['description'] }}">
        <link rel="canonical" href="{{ $seo['url'] }}">

        <meta property="og:type" content="article">
        <meta property="og:site_name" content="Property Basket">
        <meta property="og:title" content="{{ $seo['title'] }}">
        <meta property="og:description" content="{{ $seo['description'] }}">
        <meta property="og:url" content="{{ $seo['url'] }}">
        <meta property="og:image" content="{{ $seo['image'] }}">
        <meta property="og:locale" content="en_ZA">
        @if($seo['published'])<meta property="article:published_time" content="{{ $seo['published'] }}">@endif

        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="{{ $seo['title'] }}">
        <meta name="twitter:description" content="{{ $seo['description'] }}">
        <meta name="twitter:image" content="{{ $seo['image'] }}">

        @foreach($seo['jsonld'] as $block)
            <script type="application/ld+json">{!! json_encode($block, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP) !!}</script>
        @endforeach
    @endisset

    @routes
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.tsx'])
    @inertiaHead
</head>
<body class="bg-ink-50 text-ink-900 antialiased">
    @inertia
</body>
</html>
