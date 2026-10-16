import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { router, useForm } from '@inertiajs/react';
import { btnOutline, btnPrimary } from '@/Components/Dashboard/Charts';
import { Spinner } from '@/Components/Skeleton';
import {
    Activity, CHANNEL, CHANNELS, ChannelKey, OUTCOME, OUTCOMES, OutcomeKey, Profile, Prospect, STATUS, STATUSES,
    Scheme, StatusKey, Suburb, isCompany, normPhone,
} from './constants';
import { DEFAULT_MESSAGE, PLAYBOOK } from './playbook';

const input = 'w-full bg-white border border-ink-200 rounded-xl px-3 py-2 text-[13.5px] focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-100';
const label = 'text-[11px] font-semibold uppercase tracking-wider text-ink-500 mb-1.5 block';

type Props = {
    prospect: Prospect | null; // null = new prospect
    scheme: Scheme;
    suburb: Suburb;
    history: Activity[];
    editable: boolean;
    profile?: Profile;
    onClose: () => void;
};

export default function ProspectDrawer({ prospect, scheme, suburb, history, editable, profile, onClose }: Props) {
    const isNew = !prospect;
    const form = useForm({
        unit: prospect?.unit ?? '',
        size: prospect?.size ?? '',
        owner_name: prospect?.owner_name ?? '',
        owner_type: prospect?.owner_type ?? 'Individual',
        id_reg: prospect?.id_reg ?? '',
        multi_unit: prospect?.multi_unit ?? '',
        phone1: prospect?.phone1 ?? '',
        phone2: prospect?.phone2 ?? '',
        email: prospect?.email ?? '',
        priority_note: prospect?.priority_note ?? '',
        status: (prospect?.status ?? 'not_contacted') as StatusKey,
        method: (prospect?.method ?? '') as ChannelKey | '',
        contacted_on: prospect?.contacted_on ?? '',
        est_value: prospect?.est_value != null ? String(prospect.est_value) : '',
        response: prospect?.response ?? '',
        next_action: prospect?.next_action ?? '',
        notes: prospect?.notes ?? '',
        wa_opt_in: !!prospect?.wa_opt_in_at,
    });

    useEffect(() => {
        const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', esc);
        return () => window.removeEventListener('keydown', esc);
    }, [onClose]);

    function save(e: FormEvent) {
        e.preventDefault();
        const opts = { preserveScroll: true, onSuccess: onClose };
        form.transform((d) => ({ ...d, method: d.method || null, est_value: d.est_value === '' ? null : d.est_value, contacted_on: d.contacted_on || null }));
        if (isNew) form.post(`/agent/crm/schemes/${scheme.id}/prospects`, opts);
        else form.patch(`/agent/crm/prospects/${prospect.id}`, opts);
    }

    function destroy() {
        if (!prospect || !confirm(`Delete ${prospect.owner_name} from ${scheme.name}?`)) return;
        router.delete(`/agent/crm/prospects/${prospect.id}`, { preserveScroll: true, onSuccess: onClose });
    }

    function sendToPipeline() {
        if (!prospect) return;
        router.post(`/agent/crm/prospects/${prospect.id}/pipeline`, {}, { preserveScroll: true });
    }

    const ro = !editable;
    const field = (key: keyof typeof form.data, title: string, props: Record<string, unknown> = {}) => (
        <div>
            <label className={label}>{title}</label>
            <input value={String(form.data[key] ?? '')} onChange={(e) => form.setData(key, e.target.value as never)} readOnly={ro} className={input + (ro ? ' bg-ink-50' : '')} {...props} />
            {form.errors[key] && <p className="text-[11px] text-danger mt-1">{form.errors[key]}</p>}
        </div>
    );

    return (
        <>
            <div className="fixed inset-0 z-40 bg-ink-900/40" onClick={onClose} />
            <aside className="fixed top-0 right-0 bottom-0 z-50 w-[min(480px,96vw)] bg-white shadow-lift flex flex-col">
                <div className="px-5 py-4 border-b border-ink-200 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="text-[18px] font-semibold tracking-tight truncate">{isNew ? 'New prospect' : prospect.owner_name}</h2>
                        <p className="text-[12px] text-ink-500 truncate">
                            {scheme.name}{prospect?.unit ? ` · unit ${prospect.unit}` : ''} · {suburb.name}
                            {!editable && prospect?.agent ? ` · ${prospect.agent}` : ''}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="w-8 h-8 rounded-full border border-ink-200 flex items-center justify-center text-ink-500 hover:text-ink-900 shrink-0" aria-label="Close">✕</button>
                </div>

                <form onSubmit={save} className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                    {/* Quick contact buttons */}
                    {prospect && (prospect.phone1 || prospect.phone2 || prospect.email) && (
                        <div className="flex flex-wrap gap-2">
                            {[prospect.phone1, prospect.phone2].map(normPhone).filter(Boolean).map((p) => (
                                <span key={p!.tel} className="inline-flex gap-1">
                                    <a href={`tel:${p!.tel}`} className="px-3 py-1.5 rounded-full border border-ink-200 text-[12px] font-semibold hover:bg-ink-50">Call {p!.disp}</a>
                                    <a href={`https://wa.me/${p!.wa}`} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-full border border-[#25A55F]/40 text-[#1e8a4f] text-[12px] font-semibold hover:bg-[#25A55F]/10">WhatsApp</a>
                                </span>
                            ))}
                            {prospect.email && <a href={`mailto:${prospect.email}`} className="px-3 py-1.5 rounded-full border border-ink-200 text-[12px] font-semibold hover:bg-ink-50">Email</a>}
                        </div>
                    )}

                    {/* Log a contact */}
                    {prospect && editable && <LogContact prospect={prospect} />}

                    {/* Pipeline hand-off */}
                    {prospect && (
                        prospect.inquiry_id ? (
                            <p className="rounded-xl bg-violet-50 border border-violet-200 text-violet-800 text-[12.5px] px-3.5 py-2.5 font-medium">On the pipeline as a seller lead.</p>
                        ) : editable && ['interested', 'appraisal_booked', 'contacted'].includes(prospect.status) ? (
                            <div className="rounded-xl bg-brand-50 border border-brand-100 px-3.5 py-3 flex items-center justify-between gap-3">
                                <p className="text-[12.5px] text-brand-800">Warm owner? Track the listing opportunity on your pipeline.</p>
                                <button type="button" onClick={sendToPipeline} className={`${btnPrimary} !py-2 !text-[12px] shrink-0`}>Send to pipeline</button>
                            </div>
                        ) : null
                    )}

                    <Section title="Owner">
                        <div className="grid grid-cols-2 gap-3">
                            {field('unit', 'Unit')}
                            {field('size', 'Unit size (m²)')}
                        </div>
                        {field('owner_name', 'Registered owner(s)', { required: true })}
                        <div className="grid grid-cols-2 gap-3">
                            {field('owner_type', 'Owner type')}
                            {field('id_reg', 'ID / Reg number')}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {field('phone1', 'Phone 1')}
                            {field('phone2', 'Phone 2')}
                        </div>
                        {field('email', 'Email', { type: 'email' })}
                        {field('priority_note', 'Outreach priority note')}
                    </Section>

                    <Section title="Tracking">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={label}>Contact status</label>
                                <select value={form.data.status} disabled={ro} onChange={(e) => form.setData('status', e.target.value as StatusKey)} className={input} style={{ color: STATUS[form.data.status].color }}>
                                    {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={label}>Contact method</label>
                                <select value={form.data.method} disabled={ro} onChange={(e) => form.setData('method', e.target.value as ChannelKey)} className={input}>
                                    <option value="">—</option>
                                    {CHANNELS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {field('contacted_on', 'Date contacted', { type: 'date' })}
                            {field('est_value', 'Est. value (R)', { inputMode: 'numeric' })}
                        </div>
                        {field('response', 'Response')}
                        {field('next_action', 'Next action')}
                        {prospect?.wa_opted_out_at ? (
                            <p className="rounded-xl bg-danger/10 border border-danger/30 text-danger text-[12.5px] px-3.5 py-2.5">
                                Replied STOP on WhatsApp ({prospect.wa_opted_out_at}). Campaigns skip this owner. Ticking the box below opts them back in.
                            </p>
                        ) : null}
                        <label className={`flex items-start gap-2.5 rounded-xl border border-ink-200 px-3.5 py-2.5 ${ro ? '' : 'cursor-pointer'}`}>
                            <input type="checkbox" disabled={ro} checked={form.data.wa_opt_in} onChange={(e) => form.setData('wa_opt_in', e.target.checked)} className="mt-0.5 rounded border-ink-300" />
                            <span className="text-[12.5px]">
                                <b>Agreed to WhatsApp messages</b>
                                <span className="block text-ink-500">{prospect?.wa_opt_in_at ? `Since ${prospect.wa_opt_in_at}` : 'Tick when the owner says yes to WhatsApp updates.'}</span>
                            </span>
                        </label>
                        <div>
                            <label className={label}>Notes</label>
                            <textarea value={form.data.notes} readOnly={ro} onChange={(e) => form.setData('notes', e.target.value)} rows={3} className={input + ' resize-y'} />
                        </div>
                    </Section>

                    {prospect && (
                        <Section title={`Contact history (${history.length})`}>
                            {history.length === 0 ? <p className="text-[12.5px] text-ink-400">No contacts logged yet.</p> : (
                                <ul className="space-y-2">
                                    {history.map((a) => (
                                        <li key={a.id} className="flex items-start justify-between gap-3 text-[12.5px]">
                                            <span className="min-w-0">
                                                <span className="font-semibold">{CHANNEL[a.channel]?.label ?? a.channel}</span>
                                                {a.outcome && <span className="text-ink-500"> · {OUTCOME[a.outcome]?.label}</span>}
                                                {a.note && <span className="block text-ink-500">{a.note}</span>}
                                            </span>
                                            <span className="text-[11px] text-ink-400 shrink-0 flex items-center gap-2">
                                                {a.when}
                                                {editable && (
                                                    <button type="button" title="Remove" className="text-ink-300 hover:text-danger"
                                                        onClick={() => confirm('Remove this logged contact?') && router.delete(`/agent/crm/activities/${a.id}`, { preserveScroll: true })}>✕</button>
                                                )}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Section>
                    )}

                    {editable && profile && (
                        <Section title="Draft outreach message">
                            <DraftBox owner={form.data.owner_name} ownerType={form.data.owner_type} priority={form.data.priority_note} phone={form.data.phone1} suburb={suburb} profile={profile} />
                        </Section>
                    )}
                </form>

                {editable && (
                    <div className="px-5 py-3.5 border-t border-ink-200 flex items-center justify-between gap-2">
                        {isNew ? <span /> : (
                            <button type="button" onClick={destroy} className="px-4 py-2.5 rounded-full text-[13px] font-semibold text-danger hover:bg-danger/10">Delete</button>
                        )}
                        <div className="flex gap-2">
                            <button type="button" onClick={onClose} className={btnOutline}>Cancel</button>
                            <button type="button" onClick={save} disabled={form.processing} className={btnPrimary}>
                                {form.processing && <Spinner size={13} />}{isNew ? 'Add prospect' : 'Save'}
                            </button>
                        </div>
                    </div>
                )}
            </aside>
        </>
    );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="space-y-3 pt-4 border-t border-ink-100 first:border-0 first:pt-0">
            <h3 className="text-[11.5px] font-bold uppercase tracking-wider text-ink-500">{title}</h3>
            {children}
        </section>
    );
}

/** One contact with this owner → outreach stats + status moves on. */
function LogContact({ prospect }: { prospect: Prospect }) {
    const today = new Date().toISOString().slice(0, 10);
    const [channel, setChannel] = useState<ChannelKey>(prospect.method ?? 'call');
    const [outcome, setOutcome] = useState<OutcomeKey>('no_answer');
    const [note, setNote] = useState('');
    const [date, setDate] = useState(today);
    const [busy, setBusy] = useState(false);

    function log() {
        setBusy(true);
        router.post('/agent/crm/activities', {
            prospect_id: prospect.id, channel, outcome, note: note || null, occurred_on: date,
        }, { preserveScroll: true, onSuccess: () => setNote(''), onFinish: () => setBusy(false) });
    }

    const pill = (on: boolean) => 'px-2.5 py-1 rounded-full text-[11.5px] font-semibold border transition ' +
        (on ? 'bg-brand-700 text-white border-brand-700' : 'border-ink-200 text-ink-600 hover:bg-ink-50');

    return (
        <div className="rounded-2xl border border-ink-200 p-3.5 space-y-2.5 bg-ink-50/50">
            <p className="text-[11.5px] font-bold uppercase tracking-wider text-ink-500">Log a contact</p>
            <div className="flex flex-wrap gap-1.5">
                {CHANNELS.filter((c) => ['call', 'whatsapp', 'sms', 'email', 'door', 'letter'].includes(c.key)).map((c) => (
                    <button type="button" key={c.key} onClick={() => setChannel(c.key)} className={pill(channel === c.key)}>{c.label}</button>
                ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
                {OUTCOMES.map((o) => (
                    <button type="button" key={o.key} onClick={() => setOutcome(o.key)} className={pill(outcome === o.key)}>{o.label}</button>
                ))}
            </div>
            <div className="flex gap-2">
                <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="What happened? (optional)" className={input + ' flex-1 !py-1.5 !text-[12.5px]'} />
                <input type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} className={input + ' !w-[140px] !py-1.5 !text-[12.5px]'} />
            </div>
            <button type="button" onClick={log} disabled={busy} className={`${btnPrimary} !py-2 !text-[12px] w-full`}>
                {busy && <Spinner size={12} />}Log {CHANNEL[channel].label.toLowerCase()} · {OUTCOME[outcome].label.toLowerCase()}
            </button>
        </div>
    );
}

// ── Draft outreach (playbook → filled script), as in the farming dashboard ──

function ownerDisplayName(n: string) {
    n = n.trim();
    if (!n) return 'there';
    if (/\b(PTY|LTD|CC|TRUST|INV|PROP|HOLDINGS|BK|BELEGGINGS|INVESTMENTS?|GROUP)\b/i.test(n)) return n;
    return n.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function recommendApproach(ownerType: string, priority: string, suburb: Suburb) {
    const t = `${ownerType} ${priority}`;
    if (/comp|trust|pty|cc|invest|landlord|cross-build|whole-build|absentee/i.test(t) || isCompany(ownerType)) return 3;
    const s = suburb.stats;
    if (s) {
        if (s.owners50 != null && s.owners50 >= 0.6) return 2;
        if (s.turnover != null && s.turnover >= 0.08) return 5;
        if (s.sectionalPct != null && s.sectionalPct >= 0.85) return 3;
    }
    return 1;
}

function DraftBox({ owner, ownerType, priority, phone, suburb, profile }: {
    owner: string; ownerType: string; priority: string; phone: string; suburb: Suburb; profile: Profile;
}) {
    const rec = recommendApproach(ownerType, priority, suburb);
    const [approach, setApproach] = useState(rec);
    const [channel, setChannel] = useState<'whatsapp' | 'email' | 'call'>('whatsapp');
    const [copied, setCopied] = useState(false);

    const fill = (text: string) => text
        .replace(/\[Owner name\]/g, ownerDisplayName(owner))
        .replace(/\[Suburb\]/g, suburb.name)
        .replace(/\[Your name\]/g, profile.name || '[Your name]')
        .replace(/\[Agency\]/g, profile.agency || '[Agency]')
        .replace(/\[phone\]/g, profile.phone || '[phone]')
        .replace(/\[comparable\]/g, '[a recent nearby sale]');

    const ap = PLAYBOOK.find((a) => a.id === approach) ?? PLAYBOOK[0];
    const { text, subject, meta } = useMemo(() => channel === 'call'
        ? { text: fill(ap.call), subject: '', meta: `▸ ${fill(ap.point)}` }
        : { text: fill(DEFAULT_MESSAGE.body), subject: fill(DEFAULT_MESSAGE.subject), meta: '▸ Standard free value-report message' },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [channel, approach, owner, suburb.name, profile]);
    const ph = normPhone(phone);

    function copy() {
        navigator.clipboard.writeText(channel === 'email' ? `Subject: ${subject}\n\n${text}` : text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    }

    return (
        <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className={label}>Channel</label>
                    <select value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)} className={input}>
                        <option value="whatsapp">WhatsApp message</option>
                        <option value="email">Email</option>
                        <option value="call">Call script</option>
                    </select>
                </div>
                {channel === 'call' && (
                    <div>
                        <label className={label}>Call approach</label>
                        <select value={approach} onChange={(e) => setApproach(Number(e.target.value))} className={input}>
                            {PLAYBOOK.map((a) => <option key={a.id} value={a.id}>{a.id} · {a.name}{a.id === rec ? ' (recommended)' : ''}</option>)}
                        </select>
                    </div>
                )}
            </div>
            <p className="text-[11.5px] text-ink-500 italic">{meta}</p>
            {channel === 'email' && <input readOnly value={subject} className={input + ' bg-ink-50'} />}
            <textarea readOnly value={text} rows={8} className={input + ' bg-ink-50 text-[12.5px] leading-relaxed'} />
            <div className="flex flex-wrap gap-2">
                <button type="button" onClick={copy} className={`${btnOutline} !py-2 !text-[12px]`}>{copied ? 'Copied ✓' : 'Copy'}</button>
                {channel === 'whatsapp' && (
                    <a
                        href={ph ? `https://wa.me/${ph.wa}?text=${encodeURIComponent(text)}` : undefined}
                        target="_blank"
                        rel="noreferrer"
                        aria-disabled={!ph}
                        title={ph ? '' : 'No phone number on this prospect'}
                        className={`${btnPrimary} !py-2 !text-[12px] ${ph ? '' : 'opacity-40 pointer-events-none'}`}
                    >
                        Send on WhatsApp
                    </a>
                )}
            </div>
            <p className="text-[11px] text-ink-400">Uses your name ({profile.name}), agency and phone from your profile.</p>
        </div>
    );
}

