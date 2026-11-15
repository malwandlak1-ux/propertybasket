/**
 * Web push in the browser: register the service worker, subscribe this device
 * and tell the server. Alerts then arrive even when the site is closed.
 */

function csrf(): string {
    return (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content ?? '';
}

async function api(method: string, url: string, body?: unknown) {
    const res = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': csrf(), 'X-Requested-With': 'XMLHttpRequest' },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return res.json().catch(() => ({}));
}

export function pushSupported(): boolean {
    return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext;
}

/** iPhone/iPad Safari only allows web push once the site is added to the Home Screen. */
export function needsHomeScreen(): boolean {
    if (typeof navigator === 'undefined') return false;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    return ios && !standalone;
}

export function permission(): NotificationPermission | 'unsupported' {
    return pushSupported() ? Notification.permission : 'unsupported';
}

async function registration(): Promise<ServiceWorkerRegistration> {
    const existing = await navigator.serviceWorker.getRegistration('/');
    return existing ?? navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

function keyBytes(b64url: string): Uint8Array {
    const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
    const raw = atob((b64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const flagKey = (userId: number) => `pb-push:${userId}`;

/** Is this browser currently subscribed (and sending to this user)? */
export async function isSubscribed(userId: number): Promise<boolean> {
    if (!pushSupported() || Notification.permission !== 'granted') return false;
    try {
        const reg = await navigator.serviceWorker.getRegistration('/');
        const sub = await reg?.pushManager.getSubscription();
        return !!sub && localStorage.getItem(flagKey(userId)) === 'on';
    } catch {
        return false;
    }
}

/** Ask permission, subscribe this device and save it on the server. */
export async function enablePush(userId: number): Promise<'on' | 'denied' | 'unsupported'> {
    if (!pushSupported()) return 'unsupported';
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return 'denied';
    const reg = await registration();
    await navigator.serviceWorker.ready;
    const { key } = await api('GET', '/push/key');
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) as BufferSource });
    await api('POST', '/push/subscriptions', sub.toJSON());
    try { localStorage.setItem(flagKey(userId), 'on'); } catch { /* private mode */ }
    return 'on';
}

export async function disablePush(userId: number): Promise<void> {
    try { localStorage.removeItem(flagKey(userId)); } catch { /* private mode */ }
    if (!pushSupported()) return;
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
        await api('DELETE', '/push/subscriptions', { endpoint: sub.endpoint }).catch(() => undefined);
        await sub.unsubscribe().catch(() => undefined);
    }
}

export async function sendTestPush(): Promise<number> {
    const { sent } = await api('POST', '/push/test');
    return Number(sent ?? 0);
}

/**
 * After signing in again on a device that had alerts on for this user, quietly
 * re-link it (signing out removed it on the server). Never prompts.
 */
export async function resyncPush(userId: number): Promise<void> {
    if (!pushSupported() || Notification.permission !== 'granted') return;
    try {
        if (localStorage.getItem(flagKey(userId)) !== 'on') return;
        const reg = await registration();
        const sub = await reg.pushManager.getSubscription();
        if (sub) await api('POST', '/push/subscriptions', sub.toJSON());
        else await enablePush(userId);
    } catch { /* offline or blocked: try next visit */ }
}
