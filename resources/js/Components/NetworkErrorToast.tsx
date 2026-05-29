import { useEffect, useState } from 'react';
import { router } from '@inertiajs/react';

type Toast = {
    id: number;
    message: string;
};

/**
 * Listens for Inertia request errors / exceptions and shows a dismissable
 * toast in the bottom-right corner. Each toast auto-dismisses after 6 seconds.
 *
 * Mount this once near the root of your app (already done in app.tsx).
 */
export default function NetworkErrorToast() {
    const [toasts, setToasts] = useState<Toast[]>([]);

    useEffect(() => {
        const seq = { current: 0 };

        function push(message: string) {
            const id = ++seq.current;
            setToasts((curr) => [...curr, { id, message }]);
            setTimeout(() => {
                setToasts((curr) => curr.filter((t) => t.id !== id));
            }, 6000);
        }

        // Fires for true network errors (e.g. server down, DNS failure).
        const offError = router.on('error', (event) => {
            const errors = (event.detail as { errors?: Record<string, string> }).errors ?? {};
            // 4xx validation errors are surfaced via form errors already — ignore them here.
            if (Object.keys(errors).length > 0) return;
            push("We couldn't reach the server. Please check your connection and try again.");
        });

        // Fires for 5xx responses (treated as exceptions by Inertia).
        const offException = router.on('exception', (event) => {
            const detail = event.detail as { exception?: Error };
            const msg = detail.exception?.message || 'Something went wrong on the server.';
            push(msg.length > 140 ? msg.slice(0, 137) + '…' : msg);
        });

        // Fires for failed/aborted XHRs (often timeouts).
        const offInvalid = router.on('invalid', () => {
            push('That request was rejected. Please refresh and try again.');
        });

        return () => {
            offError();
            offException();
            offInvalid();
        };
    }, []);

    function dismiss(id: number) {
        setToasts((curr) => curr.filter((t) => t.id !== id));
    }

    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[60] space-y-2 max-w-sm pointer-events-none">
            {toasts.map((t) => (
                <div
                    key={t.id}
                    className="bg-white border border-danger/40 rounded-xl shadow-card p-4 flex items-start gap-3 pointer-events-auto"
                    style={{ animation: 'pb-fade-in 0.2s ease-out' }}
                    role="alert"
                >
                    <div className="w-8 h-8 rounded-lg bg-danger/15 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M12 8v4M12 16h.01"/>
                        </svg>
                    </div>
                    <p className="text-[12px] text-ink-700 leading-snug flex-1">{t.message}</p>
                    <button
                        onClick={() => dismiss(t.id)}
                        className="text-ink-400 hover:text-ink-900 transition -mr-1 -mt-1 p-1"
                        aria-label="Dismiss"
                    >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                            <path d="M6 6l12 12M18 6l-12 12"/>
                        </svg>
                    </button>
                </div>
            ))}
        </div>
    );
}
