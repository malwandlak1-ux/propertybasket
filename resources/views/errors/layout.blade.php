<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title ?? 'Error' }} · Property Basket</title>
    <link rel="icon" type="image/png" href="/images/logo-icon.png">
    <style>
        :root {
            --brand: #F26A1B;
            --brand-dark: #4429cc;
            --ink-900: #0B0B0F;
            --ink-700: #374151;
            --ink-500: #6B7280;
            --ink-200: #E5E7EB;
            --ink-50: #F9FAFB;
        }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; height: 100%; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: var(--ink-50);
            color: var(--ink-900);
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            -webkit-font-smoothing: antialiased;
        }
        header {
            padding: 24px 32px;
            border-bottom: 1px solid var(--ink-200);
            background: #ffffff;
        }
        header a { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; color: var(--ink-900); }
        header img { height: 28px; width: auto; }
        header .brand { font-weight: 700; font-size: 16px; letter-spacing: -0.01em; }
        main {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px 24px;
        }
        .card {
            max-width: 560px;
            width: 100%;
            background: #ffffff;
            border: 1px solid var(--ink-200);
            border-radius: 16px;
            padding: 48px 40px;
            text-align: center;
            box-shadow: 0 1px 2px rgba(11,11,15,0.04);
        }
        .status {
            display: inline-block;
            font-size: 84px;
            font-weight: 800;
            line-height: 1;
            letter-spacing: -0.04em;
            color: var(--brand);
            margin-bottom: 8px;
        }
        h1 {
            font-size: 24px;
            font-weight: 700;
            margin: 12px 0 8px;
            color: var(--ink-900);
        }
        p {
            font-size: 14px;
            line-height: 1.6;
            color: var(--ink-500);
            margin: 0 0 24px;
        }
        .actions {
            display: flex;
            gap: 10px;
            justify-content: center;
            flex-wrap: wrap;
        }
        .btn {
            display: inline-block;
            padding: 11px 22px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            text-decoration: none;
            transition: background 0.15s ease, transform 0.05s ease;
        }
        .btn-primary { background: var(--ink-900); color: #ffffff; }
        .btn-primary:hover { background: #1a1a1f; }
        .btn-secondary {
            background: #ffffff;
            color: var(--ink-700);
            border: 1px solid var(--ink-200);
        }
        .btn-secondary:hover { background: var(--ink-50); }
        .btn:active { transform: translateY(1px); }
        footer {
            padding: 16px 32px;
            text-align: center;
            font-size: 12px;
            color: var(--ink-500);
        }
        footer a { color: var(--brand); text-decoration: none; font-weight: 600; }
        footer a:hover { text-decoration: underline; }
        @media (max-width: 480px) {
            .card { padding: 36px 24px; }
            .status { font-size: 64px; }
            h1 { font-size: 20px; }
        }
    </style>
</head>
<body>
    <header>
        <a href="/">
            <img src="/images/logo-icon.png" alt="">
            <span class="brand">Property Basket</span>
        </a>
    </header>

    <main>
        <div class="card">
            <div class="status">{{ $status ?? '' }}</div>
            <h1>@yield('heading')</h1>
            <p>@yield('body')</p>
            <div class="actions">
                @yield('actions')
            </div>
        </div>
    </main>

    <footer>
        Still stuck? Email <a href="mailto:support@propertybasket.co.za">support@propertybasket.co.za</a>
    </footer>
</body>
</html>
