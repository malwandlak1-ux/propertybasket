/**
 * LeadDetailsModal — popup shown when an agent clicks a lead card on the pipeline
 * or a viewing on the calendar. Reveals the contact details (email, phone,
 * message) + listing context + quick actions, and lets the agent set the viewing
 * date/time (which puts the lead on the viewings calendar).
 */
import { FormEvent, useState } from 'react';
import { router } from '@inertiajs/react';
import { Spinner } from '@/Components/Skeleton';

export type Lead = {
    id: number;
    visitor_name: string;
    email: string | null;
    phone: string | null;
    message: string | null;
    listing_id: number | null;
    listing_title?: string | null;
    listing_type?: string | null;
    listing_slug?: string | null;
    deal_value: number;
    is_hot: boolean;
    status: string;
    source: string | null;
    created_at: string | null;
    age_label: string;
    viewing_at?: string | null;
    viewing_date?: string | null;
    viewing_time?: string | null;
};

type Props = {
    lead: Lead;
    onClose: () => void;
    /** Show the date/time picker for the viewing (agent's own leads). */
    canSchedule?: boolean;
    /** Open with the picker highlighted, e.g. right after a card is dropped into Viewing. */
    promptSchedule?: boolean;
};

const STATUS_LABELS: Record<string, string> = {
    new:       'New Lead',
    contacted: 'Contacted',
    qualified: 'Qualified',
    viewing:   'Viewing',
    offer:     'Offer',
    closed:    'Closed Won',
    registered:   'Registered',
    lost:         'Lost',
    disqualified: 'Disqualified',
};

const STATUS_TONES: Record<string, string> = {
    new:       'bg-ink-100 text-ink-700',
    contacted: 'bg-sky-50 text-sky-700',
    qualified: 'bg-brand-50 text-brand-700',
    viewing:   'bg-violet-50 text-violet-700',
    offer:     'bg-warning/15 text-warning',
    closed:    'bg-success/15 text-success',
    registered:   'bg-violet-100 text-violet-800',
    lost:         'bg-ink-100 text-ink-600',
    disqualified: 'bg-danger/10 text-danger',
};

function fmtMoney(n: number, type?: string | null): string {
    const base = 'R ' + Math.round(n).toLocaleString('en-ZA');
    if (type === 'long_term_rent') return base + '/mo';
    return base;
}

export default function LeadDetailsModal({ lead, onClose, canSchedule = true, promptSchedule = false }: Props) {
    const initials = lead.visitor_name
        .split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
    const schedulable = canSchedule && lead.status !== 'registered';

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div
                className="bg-white rounded-xl shadow-lift max-w-xl w-full overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-ink-200 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-sm shrink-0">
                            {initials}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-lg font-bold truncate">{lead.visitor_name}</h2>
                                {lead.is_hot && (
                                    <span className="text-[9px] bg-danger/15 text-danger px-1.5 py-0.5 rounded font-bold">HOT</span>
                                )}
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${STATUS_TONES[lead.status] ?? STATUS_TONES.new}`}>
                                    {STATUS_LABELS[lead.status] ?? lead.status}
                                </span>
                            </div>
                            <p className="text-[12px] text-ink-500 mt-0.5">
                                {lead.source === 'agent_manual' ? 'Added by you' :
                                 lead.source === 'website' ? 'Inquired from website' :
                                 lead.source ?? 'Lead'}
                                {lead.created_at && ` · ${lead.created_at}`}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-ink-400 hover:text-ink-900 text-2xl leading-none -mt-1 -mr-1 p-1 shrink-0"
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-5">
                    {/* Contact details */}
                    <div>
                        <h3 className="text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-2.5">Contact</h3>
                        <div className="space-y-2">
                            <Row icon={
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6"/>
                            }>
                                <a href={`mailto:${lead.email}`} className="text-brand-600 hover:underline font-medium">{lead.email ?? '—'}</a>
                                {lead.email && (
                                    <button
                                        onClick={() => navigator.clipboard.writeText(lead.email!)}
                                        title="Copy email"
                                        className="ml-2 text-[10px] text-ink-400 hover:text-ink-700"
                                    >
                                        copy
                                    </button>
                                )}
                            </Row>
                            <Row icon={
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                            }>
                                {lead.phone
                                    ? <a href={`tel:${lead.phone}`} className="text-brand-600 hover:underline font-medium">{lead.phone}</a>
                                    : <span className="text-ink-400 italic">No phone provided</span>}
                                {lead.phone && (
                                    <button
                                        onClick={() => navigator.clipboard.writeText(lead.phone!)}
                                        title="Copy phone"
                                        className="ml-2 text-[10px] text-ink-400 hover:text-ink-700"
                                    >
                                        copy
                                    </button>
                                )}
                            </Row>
                        </div>
                    </div>

                    {/* Listing context */}
                    {lead.listing_title && (
                        <div>
                            <h3 className="text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-2.5">Interested in</h3>
                            <div className="bg-ink-50 border border-ink-200 rounded-lg p-3 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[13px] font-semibold truncate">{lead.listing_title}</p>
                                    {lead.deal_value > 0 && (
                                        <p className="text-[12px] text-ink-500 mt-0.5">Deal value: <span className="font-mono font-semibold text-ink-900">{fmtMoney(lead.deal_value, lead.listing_type)}</span></p>
                                    )}
                                </div>
                                {lead.listing_slug && (
                                    <a
                                        href={`/properties/${lead.listing_slug}`}
                                        target="_blank"
                                        rel="noopener"
                                        className="text-[11px] text-brand-600 hover:underline shrink-0 font-semibold"
                                    >
                                        View listing →
                                    </a>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Viewing — date/time picker feeds the viewings calendar */}
                    {schedulable ? (
                        <ViewingScheduler lead={lead} prompt={promptSchedule} onSaved={onClose} />
                    ) : lead.viewing_at && (
                        <div className="bg-brand-50 border border-brand-100 rounded-lg p-3 flex items-center gap-2.5">
                            <svg className="w-4 h-4 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>
                            </svg>
                            <span className="text-[13px] font-semibold text-brand-700">Viewing scheduled: {lead.viewing_at}</span>
                        </div>
                    )}

                    {/* Message */}
                    {lead.message && (
                        <div>
                            <h3 className="text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-2.5">Message / Notes</h3>
                            <p className="text-[13px] text-ink-700 bg-ink-50 border border-ink-200 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
                                {lead.message}
                            </p>
                        </div>
                    )}

                    {/* Pipeline meta */}
                    <div className="text-[11px] text-ink-500 pt-1 border-t border-ink-100">
                        Last update: {lead.age_label}
                    </div>
                </div>

                {/* Footer actions */}
                <div className="px-6 py-4 bg-ink-50 border-t border-ink-200 flex flex-wrap items-center justify-end gap-2">
                    {lead.email && (
                        <a
                            href={`mailto:${lead.email}`}
                            className="px-3 py-1.5 text-[12px] border border-ink-200 bg-white rounded-md hover:bg-ink-100 font-semibold inline-flex items-center gap-1.5 transition"
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6"/></svg>
                            Email
                        </a>
                    )}
                    {lead.phone && (
                        <a
                            href={`tel:${lead.phone}`}
                            className="px-3 py-1.5 text-[12px] border border-ink-200 bg-white rounded-md hover:bg-ink-100 font-semibold inline-flex items-center gap-1.5 transition"
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                            Call
                        </a>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1.5 text-[12px] bg-ink-900 text-white rounded-md hover:bg-brand-500 font-semibold transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

function ViewingScheduler({ lead, prompt, onSaved }: { lead: Lead; prompt: boolean; onSaved: () => void }) {
    const [date, setDate] = useState(lead.viewing_date ?? '');
    const [time, setTime] = useState(lead.viewing_time ?? '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const dirty = date !== (lead.viewing_date ?? '') || time !== (lead.viewing_time ?? '');

    function send(payload: { viewing_date: string | null; viewing_time: string | null }) {
        setBusy(true);
        setError(null);
        router.patch(`/agent/pipeline/leads/${lead.id}/viewing`, payload, {
            preserveScroll: true,
            onSuccess: onSaved,
            onError: (e) => setError(e.viewing_date || e.viewing_time || 'Could not save the viewing.'),
            onFinish: () => setBusy(false),
        });
    }
    function save(e: FormEvent) {
        e.preventDefault();
        if (!date || !time) { setError('Pick both a date and a time.'); return; }
        send({ viewing_date: date, viewing_time: time });
    }

    const input = 'bg-white border border-ink-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand';
    return (
        <form onSubmit={save} className={`rounded-lg p-3 border ${prompt && !lead.viewing_at ? 'bg-warning/10 border-warning/40' : 'bg-brand-50 border-brand-100'}`}>
            <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>
                </svg>
                <h3 className="text-[12px] font-bold text-brand-700">
                    {lead.viewing_at ? `Viewing: ${lead.viewing_at}` : prompt ? 'When is the viewing? Pick a date and time to add it to your calendar.' : 'Schedule a viewing'}
                </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} aria-label="Viewing date" />
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} step={900} className={input} aria-label="Viewing time" />
                <button type="submit" disabled={busy || !dirty}
                    className="px-3 py-2 text-[12px] bg-brand-700 text-white rounded-md hover:bg-brand-800 disabled:opacity-50 font-semibold inline-flex items-center gap-1.5">
                    {busy && <Spinner size={12} />}{lead.viewing_at ? 'Reschedule' : 'Add to calendar'}
                </button>
                {lead.viewing_at && (
                    <button type="button" disabled={busy} onClick={() => send({ viewing_date: null, viewing_time: null })}
                        className="px-2 py-2 text-[12px] text-danger hover:underline font-semibold">Remove</button>
                )}
            </div>
            {error && <p className="text-[11px] text-danger mt-1.5">{error}</p>}
        </form>
    );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2.5 text-[13px]">
            <svg className="w-4 h-4 text-ink-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                {icon}
            </svg>
            <div className="min-w-0">{children}</div>
        </div>
    );
}
