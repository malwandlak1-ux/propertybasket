/* Property Basket service worker: shows web-push alerts while the site is closed. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data ? event.data.text() : '' }; }
    const title = data.title || 'Property Basket';
    event.waitUntil(self.registration.showNotification(title, {
        body: data.body || '',
        icon: data.icon || '/images/pwa/icon-192.png',
        badge: '/images/pwa/badge-72.png',
        tag: data.tag || undefined,
        renotify: !!data.tag,
        data: { url: data.url || '/dashboard' },
    }));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = new URL((event.notification.data && event.notification.data.url) || '/dashboard', self.location.origin).href;
    event.waitUntil((async () => {
        const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const w of wins) {
            if (new URL(w.url).origin === self.location.origin && 'focus' in w) {
                await w.focus();
                if ('navigate' in w) { try { await w.navigate(url); } catch (e) { /* cross-scope */ } }
                return;
            }
        }
        await self.clients.openWindow(url);
    })());
});
