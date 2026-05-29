import { useEffect, useState } from 'react';
import { router } from '@inertiajs/react';

/**
 * Returns `true` while an Inertia request is in flight, `false` otherwise.
 *
 * Use this to dim/skeleton sections that depend on the current URL while a
 * partial reload (e.g. a filter change) is loading.
 *
 * Example:
 *   const loading = useInertiaLoading();
 *   <div className={loading ? 'opacity-60 pointer-events-none transition-opacity' : ''}>
 *     <table>...</table>
 *   </div>
 */
export function useInertiaLoading(): boolean {
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const offStart  = router.on('start',  () => setLoading(true));
        const offFinish = router.on('finish', () => setLoading(false));
        return () => {
            offStart();
            offFinish();
        };
    }, []);

    return loading;
}
