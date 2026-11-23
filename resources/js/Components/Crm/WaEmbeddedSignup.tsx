import { useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { Spinner } from '@/Components/Skeleton';

export type EmbeddedConfig = { app_id: string; config_id: string; graph_version: string } | null;

type FBLoginResponse = { authResponse?: { code?: string } | null; status?: string };
type FBSdk = {
    init: (o: Record<string, unknown>) => void;
    login: (cb: (r: FBLoginResponse) => void, o: Record<string, unknown>) => void;
};
declare global {
    interface Window { FB?: FBSdk; fbAsyncInit?: () => void }
}

let sdkPromise: Promise<FBSdk> | null = null;

/** Load Facebook's JS SDK once (only on the page that needs it). */
function loadSdk(appId: string, version: string): Promise<FBSdk> {
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise((resolve, reject) => {
        window.fbAsyncInit = () => {
            window.FB!.init({ appId, autoLogAppEvents: true, xfbml: false, version });
            resolve(window.FB!);
        };
        const s = document.createElement('script');
        s.src = 'https://connect.facebook.net/en_US/sdk.js';
        s.async = true;
        s.defer = true;
        s.crossOrigin = 'anonymous';
        s.onerror = () => { sdkPromise = null; reject(new Error('Facebook could not be reached. Check your connection or ad blocker and try again.')); };
        document.body.appendChild(s);
    });
    return sdkPromise;
}

type Session = { waba_id: string; phone_number_id: string; coexistence: boolean };

/**
 * "Connect WhatsApp" with Meta's Embedded Signup. Two ways in:
 *  - the number is on the WhatsApp Business app → Facebook shows a QR code the
 *    agent scans in the app; the app keeps working on the phone (coexistence);
 *  - a new number → the agent adds it and verifies it by SMS / call.
 */
export default function WaEmbeddedSignup({ config }: { config: NonNullable<EmbeddedConfig> }) {
    const [busy, setBusy] = useState<null | 'app' | 'new'>(null);
    const [error, setError] = useState<string | null>(null);
    const session = useRef<Session | null>(null);
    const code = useRef<string | null>(null);

    useEffect(() => {
        function onMessage(e: MessageEvent) {
            if (!/(^|\.)facebook\.com$/.test(new URL(e.origin).hostname)) return;
            try {
                const msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
                if (msg?.type !== 'WA_EMBEDDED_SIGNUP') return;
                if (String(msg.event).startsWith('FINISH') && msg.data?.waba_id && msg.data?.phone_number_id) {
                    session.current = {
                        waba_id: String(msg.data.waba_id),
                        phone_number_id: String(msg.data.phone_number_id),
                        coexistence: msg.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',
                    };
                    finish();
                } else if (msg.event === 'CANCEL') {
                    setBusy(null);
                    setError(msg.data?.error_message ? `Meta stopped the sign-up: ${msg.data.error_message}` : 'Sign-up was closed before it finished.');
                }
            } catch { /* not ours */ }
        }
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    /** Both pieces arrive separately (popup message + login callback); post once we have both. */
    function finish() {
        const s = session.current;
        if (!s || !code.current) return;
        const payload = { code: code.current, ...s };
        code.current = null;
        session.current = null;
        router.post('/agent/crm/whatsapp/embedded', payload, { preserveScroll: true, onFinish: () => setBusy(null) });
    }

    async function start(mode: 'app' | 'new') {
        setError(null);
        setBusy(mode);
        try {
            const FB = await loadSdk(config.app_id, config.graph_version);
            FB.login((r) => {
                if (r.authResponse?.code) {
                    code.current = r.authResponse.code;
                    finish();
                } else {
                    setBusy(null);
                }
            }, {
                config_id: config.config_id,
                response_type: 'code',
                override_default_response_type: true,
                extras: {
                    setup: {},
                    sessionInfoVersion: '3',
                    ...(mode === 'app' ? { featureType: 'whatsapp_business_app_onboarding' } : {}),
                },
            });
        } catch (e) {
            setBusy(null);
            setError((e as Error).message);
        }
    }

    return (
        <section className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 sm:p-6 pb-rise">
            <h2 className="text-[18px] font-semibold tracking-tight">Connect WhatsApp</h2>
            <p className="text-[12.5px] text-ink-500 mt-0.5 mb-4">Log in with Facebook and link your number in a minute. No IDs or tokens to copy.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button type="button" onClick={() => start('app')} disabled={!!busy}
                    className="text-left rounded-2xl border-2 border-[#25D366]/60 hover:border-[#25D366] bg-[#25D366]/5 p-4 transition disabled:opacity-60">
                    <span className="flex items-center gap-2 text-[14px] font-semibold text-ink-900">
                        {busy === 'app' ? <Spinner size={14} /> : (
                            <svg className="w-5 h-5 text-[#25D366]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2M14 18h2v2M18 18h2v2h-2" /></svg>
                        )}
                        I use the WhatsApp Business app
                    </span>
                    <span className="block text-[12px] text-ink-600 mt-1.5">
                        Scan a QR code with the WhatsApp Business app on your phone. You keep using the app as normal, and your recent chats are copied into Property Basket.
                    </span>
                </button>
                <button type="button" onClick={() => start('new')} disabled={!!busy}
                    className="text-left rounded-2xl border border-ink-200 hover:border-ink-300 hover:bg-ink-50 p-4 transition disabled:opacity-60">
                    <span className="flex items-center gap-2 text-[14px] font-semibold text-ink-900">
                        {busy === 'new' && <Spinner size={14} />}
                        A new number (not on WhatsApp yet)
                    </span>
                    <span className="block text-[12px] text-ink-600 mt-1.5">
                        Add a number that isn’t on any WhatsApp app and verify it with an SMS or call. It then works only through Property Basket.
                    </span>
                </button>
            </div>
            <p className="text-[11.5px] text-ink-500 mt-3">
                Using personal WhatsApp? Switch the number to the free WhatsApp Business app first (your chats move with it), then use the QR option.
            </p>
            {error && <p className="mt-3 rounded-xl bg-danger/10 border border-danger/30 text-danger px-3.5 py-2.5 text-[12.5px]">{error}</p>}
        </section>
    );
}
