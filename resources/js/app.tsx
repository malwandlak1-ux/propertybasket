import './bootstrap';
import '../css/app.css';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import ErrorBoundary from '@/Components/ErrorBoundary';
import NetworkErrorToast from '@/Components/NetworkErrorToast';
import { installSafeUploads } from '@/lib/safeUpload';

// Every upload form: re-name files whose names the host firewall rejects (403).
installSafeUploads();

// Site name for tab titles: the white-label brand (e.g. Careline Clinic) when
// the server shares one, else the build-time app name.
const initialPage = (() => {
    try {
        const el = document.querySelector('script[data-page]') ?? document.getElementById('app');
        const raw = el instanceof HTMLScriptElement ? el.textContent : el?.getAttribute('data-page');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
})();
const appName: string = initialPage?.props?.edition?.brand?.name ?? import.meta.env.VITE_APP_NAME ?? 'Property Basket';

createInertiaApp({
    title: (title) => (title ? `${title} · ${appName}` : appName),
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.tsx`,
            import.meta.glob<{ default: React.ComponentType }>('./Pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        createRoot(el).render(
            <ErrorBoundary variant="global">
                <App {...props} />
                <NetworkErrorToast />
            </ErrorBoundary>
        );
    },
    progress: {
        color: initialPage?.props?.edition?.brand?.color ?? '#F26A1B',
    },
});
