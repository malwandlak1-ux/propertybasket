import './bootstrap';
import '../css/app.css';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import ErrorBoundary from '@/Components/ErrorBoundary';
import NetworkErrorToast from '@/Components/NetworkErrorToast';

const appName = import.meta.env.VITE_APP_NAME ?? 'Property Basket';

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
        color: '#F26A1B',
    },
});
