<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <title inertia>{{ config('app.name', 'Property Basket') }}</title>

    {{-- Favicon — use the dark logo-icon PNG. Modern browsers happily use PNG
         in place of .ico, so we don't need to convert. The empty favicon.ico
         in /public is kept only so root requests don't 404. --}}
    <link rel="icon" type="image/png" href="/images/logo-icon.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/images/logo-icon.png">
    <link rel="shortcut icon" href="/images/logo-icon.png" type="image/png">

    @routes
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.tsx'])
    @inertiaHead
</head>
<body class="bg-ink-50 text-ink-900 antialiased">
    @inertia
</body>
</html>
