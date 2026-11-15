import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import AgentLayout from '@/Layouts/AgentLayout';
import AgencyLayout from '@/Layouts/AgencyLayout';
import MessagesTabs from '@/Components/MessagesTabs';
import { FlashBanners, btnOutline, btnPrimary } from '@/Components/Dashboard/Charts';
import { Spinner } from '@/Components/Skeleton';

type Account = { email: string; display_name: string | null; protocol: 'pop3' | 'imap'; incoming_host: string; last_synced: string | null; last_error: string | null; unread: number };
type Row = { id: number; who: string; subject: string; preview: string; at: string | null; unread: boolean; has_attachments: boolean };
type Addr = { email: string; name: string | null };
type Open = { id: number; folder: 'inbox' | 'sent'; from_email: string | null; from_name: string | null; to: Addr[]; cc: Addr[]; subject: string; text: string | null; html: string | null; attachments: { name: string; size: number }[]; at: string | null };

type Props = {
    role: 'agent' | 'agency';
    base: string;
    chatsUrl: '/agent/messages' | '/agency/messages';
    account: Account | null;
    folder: 'inbox' | 'sent';
    search: string;
    messages: Row[];
    open: Open | null;
    defaultEmail: string;
    defaultName: string;
};

const field = 'w-full bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[13px] focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100 mt-1';
const lbl = 'block text-[12px] font-semibold text-ink-700';

/** Common providers: incoming POP3 + IMAP, and SMTP. */
const PRESETS: Record<string, { label: string; pop3: [string, number]; imap: [string, number]; smtp: [string, number, 'ssl' | 'tls']; note?: string }> = {
    gmail: { label: 'Gmail', pop3: ['pop.gmail.com', 995], imap: ['imap.gmail.com', 993], smtp: ['smtp.gmail.com', 465, 'ssl'], note: 'Use a Google app password (Google Account → Security → 2-Step Verification → App passwords). Your normal Gmail password will not work.' },
    outlook: { label: 'Outlook / Microsoft 365', pop3: ['outlook.office365.com', 995], imap: ['outlook.office365.com', 993], smtp: ['smtp.office365.com', 587, 'tls'], note: 'Some Microsoft 365 work accounts have POP/IMAP password sign-in switched off by the IT admin.' },
    yahoo: { label: 'Yahoo', pop3: ['pop.mail.yahoo.com', 995], imap: ['imap.mail.yahoo.com', 993], smtp: ['smtp.mail.yahoo.com', 465, 'ssl'], note: 'Yahoo needs an app password (Account security → Generate app password).' },
    hostinger: { label: 'Hostinger', pop3: ['pop.hostinger.com', 995], imap: ['imap.hostinger.com', 993], smtp: ['smtp.hostinger.com', 465, 'ssl'] },
    afrihost: { label: 'Afrihost', pop3: ['pop.afrihost.co.za', 995], imap: ['imap.afrihost.co.za', 993], smtp: ['smtp.afrihost.co.za', 465, 'ssl'] },
    other: { label: 'Other (enter your provider’s settings)', pop3: ['', 995], imap: ['', 993], smtp: ['', 465, 'ssl'] },
};

export default function Email(props: Props) {
    const { flash } = usePage<{ flash?: { success?: string | null; error?: string | null } }>().props;

    const body = (
        <>
            <Head title="Email" />
            <div className="px-4 sm:px-7 py-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <MessagesTabs base={props.chatsUrl} active="email" unreadEmail={props.account?.unread ?? 0} />
                    {props.account && <AccountBar base={props.base} account={props.account} />}
                </div>
                <FlashBanners flash={flash} />
                {props.account ? <Inbox {...props} account={props.account} /> : <ConnectForm base={props.base} defaultEmail={props.defaultEmail} defaultName={props.defaultName} />}
            </div>
        </>
    );

    return props.role === 'agency'
        ? <AgencyLayout crumb="Messages · Email">{body}</AgencyLayout>
        : <AgentLayout crumb="Messages · Email">{body}</AgentLayout>;
}

function AccountBar({ base, account }: { base: string; account: Account }) {
    const [syncing, setSyncing] = useState(false);

    return (
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-500">
            <span><span className="font-semibold text-ink-800">{account.email}</span> · {account.protocol.toUpperCase()} · {account.last_synced ? `checked ${account.last_synced}` : 'not checked yet'}</span>
            <button type="button" disabled={syncing} onClick={() => { setSyncing(true); router.post(`${base}/sync`, {}, { preserveScroll: true, onFinish: () => setSyncing(false) }); }} className={btnOutline}>
                {syncing ? <><Spinner size={13} />Checking…</> : 'Check mail'}
            </button>
            <button type="button" onClick={() => confirm('Disconnect this mailbox? Downloaded copies are removed here; nothing is deleted on your mail server.') && router.delete(`${base}/account`)} className="text-[12px] font-semibold text-danger hover:underline">Disconnect</button>
        </div>
    );
}

function ConnectForm({ base, defaultEmail, defaultName }: { base: string; defaultEmail: string; defaultName: string }) {
    const [preset, setPreset] = useState('gmail');
    const [advanced, setAdvanced] = useState(false);
    const { data, setData, post, processing, errors } = useForm({
        email: defaultEmail,
        display_name: defaultName,
        protocol: 'pop3' as 'pop3' | 'imap',
        incoming_host: PRESETS.gmail.pop3[0],
        incoming_port: PRESETS.gmail.pop3[1],
        incoming_encryption: 'ssl' as 'ssl' | 'tls' | 'none',
        username: defaultEmail,
        password: '',
        smtp_host: PRESETS.gmail.smtp[0],
        smtp_port: PRESETS.gmail.smtp[1],
        smtp_encryption: PRESETS.gmail.smtp[2] as 'ssl' | 'tls' | 'none',
        smtp_username: '',
        smtp_password: '',
    });

    function apply(key: string, protocol: 'pop3' | 'imap') {
        const p = PRESETS[key];
        const [host, port] = p[protocol];
        setData((d) => ({ ...d, protocol, incoming_host: host, incoming_port: port, incoming_encryption: 'ssl', smtp_host: p.smtp[0], smtp_port: p.smtp[1], smtp_encryption: p.smtp[2] }));
        if (key === 'other') setAdvanced(true);
    }

    const note = PRESETS[preset]?.note;

    return (
        <section className="bg-white rounded-2xl shadow-soft p-5 sm:p-6 max-w-3xl">
            <h1 className="text-[22px]">Connect your email</h1>
            <p className="text-[13px] text-ink-500 mt-1">Read and answer your email here, next to your chats. We download a copy of your latest mail and never delete anything on your mail server. Your password is stored encrypted.</p>

            <form onSubmit={(e) => { e.preventDefault(); post(`${base}/account`, { preserveScroll: true }); }} className="mt-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className={lbl}>Email provider
                        <select value={preset} onChange={(e) => { setPreset(e.target.value); apply(e.target.value, data.protocol); }} className={field}>
                            {Object.entries(PRESETS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
                        </select>
                    </label>
                    <div className={lbl}>Download mail with
                        <div className="mt-1 grid grid-cols-2 gap-2">
                            {(['pop3', 'imap'] as const).map((p) => (
                                <button key={p} type="button" onClick={() => apply(preset, p)} className={`rounded-xl border px-3 py-2.5 text-[12.5px] font-semibold text-left ${data.protocol === p ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-700'}`}>
                                    {p === 'pop3' ? 'POP3' : 'IMAP'}
                                    <span className="block text-[11px] font-normal text-ink-500">{p === 'pop3' ? 'Simple; inbox only' : 'Recommended if you also use other mail apps'}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <label className={lbl}>Email address
                        <input type="email" value={data.email} onChange={(e) => setData((d) => ({ ...d, email: e.target.value, username: d.username === d.email ? e.target.value : d.username }))} className={field} required />
                        {errors.email && <span className="text-danger text-[11px]">{errors.email}</span>}
                    </label>
                    <label className={lbl}>Name on sent mail
                        <input value={data.display_name} onChange={(e) => setData('display_name', e.target.value)} className={field} />
                    </label>
                    <label className={lbl}>Password {preset !== 'other' && preset !== 'hostinger' && preset !== 'afrihost' && <span className="font-normal text-ink-500">(app password)</span>}
                        <input type="password" value={data.password} onChange={(e) => setData('password', e.target.value)} autoComplete="new-password" className={field} required />
                        {errors.password && <span className="text-danger text-[11px]">{errors.password}</span>}
                    </label>
                </div>

                {note && <p className="text-[12px] text-ink-600 bg-ink-50 border border-ink-200 rounded-xl px-3.5 py-2.5">{note}</p>}

                <button type="button" onClick={() => setAdvanced(!advanced)} className="text-[12.5px] font-semibold text-brand-700 hover:underline">{advanced ? 'Hide server settings' : 'Show server settings'}</button>

                {advanced && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-3 border-t border-ink-100 pt-4">
                        <p className="sm:col-span-2 text-[12px] font-bold uppercase tracking-wider text-ink-500">Incoming ({data.protocol === 'pop3' ? 'POP3' : 'IMAP'})</p>
                        <label className={lbl}>Server
                            <input value={data.incoming_host} onChange={(e) => setData('incoming_host', e.target.value.trim())} className={`${field} font-mono`} placeholder="mail.yourdomain.co.za" />
                            {errors.incoming_host && <span className="text-danger text-[11px]">{errors.incoming_host}</span>}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <label className={lbl}>Port
                                <input type="number" value={data.incoming_port} onChange={(e) => setData('incoming_port', Number(e.target.value))} className={`${field} font-mono`} />
                            </label>
                            <label className={lbl}>Security
                                <select value={data.incoming_encryption} onChange={(e) => setData('incoming_encryption', e.target.value as 'ssl' | 'tls' | 'none')} className={field}>
                                    <option value="ssl">SSL/TLS</option><option value="tls">STARTTLS</option><option value="none">None</option>
                                </select>
                            </label>
                        </div>
                        <label className={`${lbl} sm:col-span-2`}>Username
                            <input value={data.username} onChange={(e) => setData('username', e.target.value)} autoComplete="off" className={`${field} font-mono`} />
                            <span className="font-normal text-[11px] text-ink-500">Usually your full email address.</span>
                        </label>

                        <p className="sm:col-span-2 text-[12px] font-bold uppercase tracking-wider text-ink-500 mt-2">Outgoing (SMTP)</p>
                        <label className={lbl}>Server
                            <input value={data.smtp_host} onChange={(e) => setData('smtp_host', e.target.value.trim())} className={`${field} font-mono`} placeholder="smtp.yourdomain.co.za" />
                            {errors.smtp_host && <span className="text-danger text-[11px]">{errors.smtp_host}</span>}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <label className={lbl}>Port
                                <input type="number" value={data.smtp_port} onChange={(e) => setData('smtp_port', Number(e.target.value))} className={`${field} font-mono`} />
                            </label>
                            <label className={lbl}>Security
                                <select value={data.smtp_encryption} onChange={(e) => setData('smtp_encryption', e.target.value as 'ssl' | 'tls' | 'none')} className={field}>
                                    <option value="ssl">SSL/TLS</option><option value="tls">STARTTLS</option><option value="none">None</option>
                                </select>
                            </label>
                        </div>
                        <label className={lbl}>SMTP username <span className="font-normal text-ink-500">(if different)</span>
                            <input value={data.smtp_username} onChange={(e) => setData('smtp_username', e.target.value)} autoComplete="off" className={`${field} font-mono`} />
                        </label>
                        <label className={lbl}>SMTP password <span className="font-normal text-ink-500">(if different)</span>
                            <input type="password" value={data.smtp_password} onChange={(e) => setData('smtp_password', e.target.value)} autoComplete="new-password" className={`${field} font-mono`} />
                        </label>
                    </div>
                )}

                {(errors as Record<string, string>).connection && <p className="text-[12.5px] text-danger bg-danger/5 border border-danger/20 rounded-xl px-3.5 py-2.5">{(errors as Record<string, string>).connection}</p>}

                <button type="submit" disabled={processing || !data.password || !data.incoming_host || !data.smtp_host} className={btnPrimary}>
                    {processing ? <><Spinner size={14} />Testing connection…</> : 'Connect mailbox'}
                </button>
            </form>
        </section>
    );
}

function Inbox({ base, account, folder, search, messages, open }: Props & { account: Account }) {
    const [q, setQ] = useState(search);
    const [compose, setCompose] = useState<null | { to: string; cc: string; subject: string; body: string; reply_to: number | null }>(null);
    const go = (params: Record<string, string | number | undefined>) => router.get(base, { folder, q: q || undefined, ...params }, { preserveState: true, preserveScroll: true });

    useEffect(() => { if (open) setCompose(null); }, [open?.id]);

    function reply(all: boolean) {
        if (!open) return;
        const me = account.email.toLowerCase();
        const to = open.folder === 'sent' ? open.to.map((a) => a.email) : [open.from_email ?? ''];
        const cc = all ? [...open.to, ...open.cc].map((a) => a.email).filter((e) => e && e.toLowerCase() !== me && !to.includes(e)) : [];
        const quoted = (open.text ?? '').split('\n').map((l) => `> ${l}`).join('\n');
        setCompose({
            to: to.filter(Boolean).join(', '),
            cc: cc.join(', '),
            subject: /^re:/i.test(open.subject) ? open.subject : `Re: ${open.subject}`,
            body: `\n\nOn ${open.at}, ${open.from_name || open.from_email} wrote:\n${quoted}`,
            reply_to: open.id,
        });
    }
    function forward() {
        if (!open) return;
        setCompose({ to: '', cc: '', subject: /^fwd?:/i.test(open.subject) ? open.subject : `Fwd: ${open.subject}`, body: `\n\n---------- Forwarded message ----------\nFrom: ${open.from_name ?? ''} <${open.from_email ?? ''}>\nDate: ${open.at}\nSubject: ${open.subject}\n\n${open.text ?? ''}`, reply_to: null });
    }

    return (
        <>
            {account.last_error && <p className="mb-4 text-[12.5px] text-danger bg-danger/5 border border-danger/20 rounded-2xl px-4 py-2.5">Last check failed: {account.last_error}</p>}
            <div className="bg-white rounded-2xl shadow-soft overflow-hidden flex flex-col lg:flex-row min-h-[calc(100vh-220px)]">
                {/* List */}
                <div className={`lg:w-[360px] shrink-0 border-b lg:border-b-0 lg:border-r border-ink-200 flex flex-col ${open || compose ? 'hidden lg:flex' : 'flex'}`}>
                    <div className="p-3 border-b border-ink-200 space-y-2">
                        <div className="flex items-center gap-2">
                            {(['inbox', 'sent'] as const).map((f) => (
                                <button key={f} type="button" onClick={() => router.get(base, { folder: f }, { preserveState: true })} className={`px-3 py-1.5 rounded-full text-[12px] font-semibold ${folder === f ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-50'}`}>
                                    {f === 'inbox' ? `Inbox${account.unread ? ` (${account.unread})` : ''}` : 'Sent'}
                                </button>
                            ))}
                            <button type="button" onClick={() => setCompose({ to: '', cc: '', subject: '', body: '', reply_to: null })} className={`${btnPrimary} ml-auto !py-1.5 !px-3 !text-[12px]`}>New email</button>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); go({}); }}>
                            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search subject or sender…" className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3 py-1.5 text-[12px] focus:outline-none focus:border-brand-300" />
                        </form>
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-[70vh] lg:max-h-none">
                        {messages.length === 0 ? (
                            <p className="p-6 text-center text-[12.5px] text-ink-400">{search ? 'No matches.' : folder === 'sent' ? 'Nothing sent from here yet.' : 'No mail yet. Click “Check mail”.'}</p>
                        ) : messages.map((m) => (
                            <button key={m.id} type="button" onClick={() => go({ message: m.id })} className={`w-full text-left px-4 py-3 border-b border-ink-100 hover:bg-ink-50 ${open?.id === m.id ? 'bg-brand-50' : ''}`}>
                                <div className="flex items-center gap-2">
                                    {m.unread && <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" aria-label="Unread" />}
                                    <p className={`text-[13px] truncate flex-1 ${m.unread ? 'font-bold text-ink-900' : 'font-medium text-ink-700'}`}>{m.who || '—'}</p>
                                    <span className="text-[10.5px] text-ink-400 shrink-0">{m.at}</span>
                                </div>
                                <p className={`text-[12.5px] truncate mt-0.5 ${m.unread ? 'font-semibold text-ink-800' : 'text-ink-700'}`}>{m.has_attachments && '📎 '}{m.subject}</p>
                                <p className="text-[11.5px] text-ink-500 truncate">{m.preview}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Reader / composer */}
                <div className={`flex-1 min-w-0 flex flex-col ${open || compose ? 'flex' : 'hidden lg:flex'}`}>
                    {compose ? (
                        <Composer base={base} initial={compose} onClose={() => setCompose(null)} from={account.email} />
                    ) : open ? (
                        <Reader open={open} onBack={() => router.get(base, { folder }, { preserveState: true })} onReply={() => reply(false)} onReplyAll={() => reply(true)} onForward={forward} />
                    ) : (
                        <div className="flex-1 grid place-items-center text-center p-10">
                            <div>
                                <p className="text-[15px] font-semibold text-ink-700">Select an email</p>
                                <p className="text-[12.5px] text-ink-500 mt-1">Or start a new one.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

function Reader({ open, onBack, onReply, onReplyAll, onForward }: { open: Open; onBack: () => void; onReply: () => void; onReplyAll: () => void; onForward: () => void }) {
    const [showHtml, setShowHtml] = useState(!!open.html);
    const list = (a: Addr[]) => a.map((x) => (x.name ? `${x.name} <${x.email}>` : x.email)).join(', ');
    const srcDoc = open.html
        ? `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{font-family:Montserrat,Arial,sans-serif;font-size:14px;color:#18181b;margin:0;padding:16px;word-wrap:break-word}img{max-width:100%;height:auto}</style></head><body>${open.html}</body></html>`
        : '';

    return (
        <div className="flex-1 flex flex-col min-h-0">
            <div className="px-5 py-4 border-b border-ink-200">
                <button type="button" onClick={onBack} className="lg:hidden text-[12px] font-semibold text-brand-700 mb-2">← Back</button>
                <h2 className="text-[18px]">{open.subject}</h2>
                <p className="text-[12.5px] text-ink-700 mt-2"><span className="font-semibold">{open.from_name || open.from_email}</span>{open.from_name && <span className="text-ink-500"> &lt;{open.from_email}&gt;</span>}</p>
                <p className="text-[11.5px] text-ink-500">To: {list(open.to) || '—'}{open.cc.length > 0 && <> · Cc: {list(open.cc)}</>}</p>
                <p className="text-[11.5px] text-ink-400">{open.at}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                    <button type="button" onClick={onReply} className={btnPrimary}>Reply</button>
                    <button type="button" onClick={onReplyAll} className={btnOutline}>Reply all</button>
                    <button type="button" onClick={onForward} className={btnOutline}>Forward</button>
                    {open.html && open.text && (
                        <button type="button" onClick={() => setShowHtml(!showHtml)} className="text-[12px] font-semibold text-ink-600 hover:underline ml-auto">{showHtml ? 'Plain text' : 'Formatted'}</button>
                    )}
                </div>
            </div>
            {open.attachments.length > 0 && (
                <div className="px-5 py-2 border-b border-ink-100 text-[12px] text-ink-600">
                    📎 {open.attachments.map((a) => `${a.name} (${Math.max(1, Math.round(a.size / 1024))} KB)`).join(' · ')}
                    <span className="text-ink-400"> — open these in your mail app</span>
                </div>
            )}
            <div className="flex-1 min-h-[360px]">
                {showHtml && open.html ? (
                    <iframe title="Email" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={srcDoc} className="w-full h-full min-h-[360px] border-0" />
                ) : (
                    <pre className="px-5 py-4 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-ink-800" style={{ fontFamily: 'inherit' }}>{open.text || '(no text)'}</pre>
                )}
            </div>
        </div>
    );
}

function Composer({ base, initial, onClose, from }: { base: string; initial: { to: string; cc: string; subject: string; body: string; reply_to: number | null }; onClose: () => void; from: string }) {
    const { data, setData, post, processing, errors } = useForm(initial);
    const err = errors as Record<string, string>;

    return (
        <form onSubmit={(e) => { e.preventDefault(); post(`${base}/send`, { preserveScroll: true, onSuccess: onClose }); }} className="flex-1 flex flex-col p-5 gap-3">
            <div className="flex items-center justify-between">
                <h2 className="text-[18px]">{initial.reply_to ? 'Reply' : 'New email'}</h2>
                <button type="button" onClick={onClose} className="text-[12px] font-semibold text-ink-500 hover:underline">Discard</button>
            </div>
            <p className="text-[12px] text-ink-500">From {from}</p>
            <label className={lbl}>To
                <input value={data.to} onChange={(e) => setData('to', e.target.value)} className={field} placeholder="name@example.com, …" required />
                {err.to && <span className="text-danger text-[11px]">{err.to}</span>}
            </label>
            <label className={lbl}>Cc
                <input value={data.cc} onChange={(e) => setData('cc', e.target.value)} className={field} />
            </label>
            <label className={lbl}>Subject
                <input value={data.subject} onChange={(e) => setData('subject', e.target.value)} className={field} required />
            </label>
            <label className={`${lbl} flex-1 flex flex-col`}>Message
                <textarea value={data.body} onChange={(e) => setData('body', e.target.value)} className={`${field} flex-1 min-h-[220px]`} required autoFocus />
            </label>
            {err.send && <p className="text-[12.5px] text-danger bg-danger/5 border border-danger/20 rounded-xl px-3.5 py-2.5">{err.send}</p>}
            <div>
                <button type="submit" disabled={processing} className={btnPrimary}>{processing ? <><Spinner size={14} />Sending…</> : 'Send'}</button>
            </div>
        </form>
    );
}
