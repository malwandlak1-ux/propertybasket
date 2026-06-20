import { Component, ReactNode, ErrorInfo } from 'react';

type Props = {
    /**
     * `global`  — full-viewport friendly error page (use to wrap the root App).
     * `section` — compact card that fits inside a dashboard section.
     */
    variant?: 'global' | 'section';
    /** Optional label displayed in section mode (e.g. "Recent Signups"). */
    label?: string;
    children: ReactNode;
};

type State = {
    error: Error | null;
};

/**
 * Catches uncaught JavaScript errors in the component tree so they don't
 * crash the whole page. The fallback offers retry + navigation escape hatches.
 *
 * Usage:
 *   // app-wide (in app.tsx)
 *   <ErrorBoundary variant="global"><App {...} /></ErrorBoundary>
 *
 *   // around a single risky widget
 *   <ErrorBoundary variant="section" label="Earnings chart">
 *     <Chart data={trend} />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        // Surface to the browser console with full stack so devs can debug.
        // In production, this is where Sentry/Bugsnag would be invoked.
        // eslint-disable-next-line no-console
        console.error('[ErrorBoundary]', error, info.componentStack);
    }

    private reset = () => this.setState({ error: null });

    private goHome = () => {
        this.reset();
        window.location.href = '/';
    };

    private reload = () => window.location.reload();

    render() {
        const { error } = this.state;
        const { variant = 'global', label, children } = this.props;

        if (! error) return children;

        if (variant === 'section') {
            return (
                <div className="bg-danger/5 border border-danger/30 rounded-xl p-5 text-center">
                    <div className="inline-flex items-center gap-2 mb-2 text-danger font-bold text-[13px]">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <path d="M12 9v4M12 17h.01"/>
                        </svg>
                        Couldn't load {label ?? 'this section'}
                    </div>
                    <p className="text-[12px] text-ink-600 mb-3 break-words max-w-md mx-auto">
                        {error.message || 'An unexpected error occurred.'}
                    </p>
                    <button
                        onClick={this.reset}
                        className="px-3 py-1.5 text-[12px] bg-ink-900 text-white rounded-md font-semibold hover:bg-brand-500 transition"
                    >
                        Try again
                    </button>
                </div>
            );
        }

        // global fallback
        return (
            <div className="min-h-screen flex items-center justify-center bg-ink-50 px-4">
                <div className="max-w-md w-full bg-white rounded-2xl border border-ink-200 shadow-card p-8 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-danger/15 mx-auto flex items-center justify-center mb-4">
                        <svg className="w-7 h-7 text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <path d="M12 9v4M12 17h.01"/>
                        </svg>
                    </div>
                    <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
                    <p className="text-[13px] text-ink-500 mb-1">
                        Sorry — the page hit an unexpected error and couldn't render.
                    </p>
                    <p className="text-[11px] text-ink-400 mb-6 font-mono break-words">
                        {error.message || 'Unknown error'}
                    </p>
                    <div className="flex items-center justify-center gap-2">
                        <button
                            onClick={this.reload}
                            className="px-4 py-2 text-[13px] bg-ink-900 text-white rounded-lg font-semibold hover:bg-brand-500 transition"
                        >
                            Reload page
                        </button>
                        <button
                            onClick={this.goHome}
                            className="px-4 py-2 text-[13px] border border-ink-200 rounded-lg font-semibold hover:bg-ink-50 transition"
                        >
                            Go home
                        </button>
                    </div>
                    <p className="text-[10px] text-ink-400 mt-6">
                        If this keeps happening, please contact{' '}
                        <a href="mailto:support@propertybasket.co.za" className="text-brand-600 hover:underline">
                            support@propertybasket.co.za
                        </a>
                    </p>
                </div>
            </div>
        );
    }
}
