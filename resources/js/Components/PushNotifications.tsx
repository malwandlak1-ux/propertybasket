import { useEffect, useState } from 'react';
import { router } from '@inertiajs/react';
import { Spinner } from '@/Components/Skeleton';
import { disablePush, enablePush, isSubscribed, needsHomeScreen, permission, pushSupported, resyncPush, sendTestPush } from '@/lib/push';

type AuthUser = { id: number; name: string } | null;

function readUser(): AuthUser {
    try {
        const el = document.querySelector('script[data-page]') ?? document.getElementById('app');
        const raw = el instanceof HTMLScriptElement ? el.textContent : el?.getAttribute('data-page');
        return raw ? (JSON.parse(raw)?.props?.auth?.user ?? null) : null;
    } catch {
        return null;
    }
}

/** The signed-in user, kept current across Inertia visits (works outside <App>). */
function useAuthUser(): AuthUser {
    const [user, setUser] = useState<AuthUser>(() => readUser());
    useEffect(() => router.on('navigate', (e) => {
        setUser(((e.detail.page.props as { auth?: { user?: AuthUser } }).auth?.user) ?? null);
    }), []);
    return user;
}

const DISMISS = 'pb-push-prompt-dismissed';

/**
 * Mounted once near the root. For signed-in users it re-links a device that had
 * alerts on, and offers once (dismissable) to switch alerts on for this device.
 */
export function PushPrompt() {
    const user = useAuthUser();
    const [show, setShow] = useState(false);
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState<string | null>(null);

    useEffect(() => {
        if (!user || !pushSupported()) { setShow(false); return; }
        resyncPush(user.id);
        let dismissed = false;
        try { dismissed = !!localStorage.getItem(DISMISS); } catch { /* ignore */ }
        // Wait a moment after sign-in so it doesn't jump at people.
        const t = window.setTimeout(() => setShow(permission() === 'default' && !dismissed && !needsHomeScreen()), 4000);
        return () => window.clearTimeout(t);
    }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!user || !show) return null;

    function dismiss() {
        try { localStorage.setItem(DISMISS, '1'); } catch { /* ignore */ }
        setShow(false);
    }
    async function turnOn() {
        setBusy(true);
        try {
            const r = await enablePush(user!.id);
            if (r === 'on') { setNote('Done. You’ll get alerts on this device even when the site is closed.'); window.setTimeout(() => setShow(false), 3500); }
            else if (r === 'denied') { setNote('Notifications are blocked for this site in your browser settings.'); }
        } catch {
            setNote('Couldn’t switch alerts on. Try again from the bell.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <div role="dialog" aria-label="Turn on notifications" className="fixed bottom-4 left-4 right-4 sm:right-auto sm:w-[360px] z-[60] bg-white rounded-2xl shadow-lift border border-ink-200/70 p-4 pb-rise">
            <div className="flex gap-3">
                <span className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
                </span>
                <div className="min-w-0">
                    <p className="text-[14px] font-semibold">Get alerts on this device?</p>
                    <p className="text-[12.5px] text-ink-500 mt-0.5">{note ?? 'New leads, WhatsApp replies, viewings and requests, even when the site is closed.'}</p>
                </div>
            </div>
            {!note && (
                <div className="flex justify-end gap-2 mt-3">
                    <button type="button" onClick={dismiss} className="px-3.5 py-2 rounded-full text-[12.5px] font-semibold text-ink-600 hover:bg-ink-50">Not now</button>
                    <button type="button" onClick={turnOn} disabled={busy} className="px-4 py-2 rounded-full bg-ink-900 text-white text-[12.5px] font-semibold hover:bg-ink-800 inline-flex items-center gap-2 disabled:opacity-60">
                        {busy && <Spinner size={12} />}Turn on
                    </button>
                </div>
            )}
        </div>
    );
}

/** On/off switch for this device, for the notification bell dropdown. */
export function PushToggle({ userId }: { userId: number }) {
    const [on, setOn] = useState(false);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const supported = pushSupported();
    const homeScreen = needsHomeScreen();

    useEffect(() => { isSubscribed(userId).then(setOn); }, [userId]);

    async function toggle() {
        setBusy(true);
        setMsg(null);
        try {
            if (on) { await disablePush(userId); setOn(false); }
            else {
                const r = await enablePush(userId);
                if (r === 'on') { setOn(true); setMsg('On for this device.'); }
                else if (r === 'denied') setMsg('Blocked in your browser settings. Allow notifications for this site, then try again.');
            }
        } catch {
            setMsg('Something went wrong. Try again.');
        } finally {
            setBusy(false);
        }
    }
    async function test() {
        setBusy(true);
        try { const n = await sendTestPush(); setMsg(n ? 'Test sent. It should pop up in a few seconds.' : 'No device accepted it. Switch alerts off and on again.'); }
        catch { setMsg('Couldn’t send a test.'); }
        finally { setBusy(false); }
    }

    if (!supported) {
        return <p className="text-[11.5px] text-ink-500">{homeScreen ? 'On iPhone, tap Share → Add to Home Screen, open it from there, then switch alerts on.' : 'This browser can’t show alerts while the site is closed.'}</p>;
    }

    return (
        <div>
            <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-semibold text-ink-800">Alerts on this device</p>
                    <p className="text-[11px] text-ink-500">Even when the site is closed</p>
                </div>
                {on && <button type="button" onClick={test} disabled={busy} className="text-[11.5px] font-semibold text-brand-600 hover:text-brand-700">Send test</button>}
                <button type="button" role="switch" aria-checked={on} aria-label="Alerts on this device" onClick={toggle} disabled={busy}
                    className={`relative w-10 h-6 rounded-full transition shrink-0 ${on ? 'bg-success' : 'bg-ink-300'} disabled:opacity-60`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : ''}`} />
                </button>
            </div>
            {msg && <p className="text-[11px] text-ink-500 mt-1.5">{msg}</p>}
        </div>
    );
}
