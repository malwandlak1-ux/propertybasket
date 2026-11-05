/**
 * ScheduleViewingModal — opens from "New entry" (or a day/slot) on the agent
 * Calendar (/agent/viewings). Two kinds of entry:
 *  - Viewing: creates an Inquiry with status=viewing + viewing_scheduled_at; same
 *    row the agency dashboard reads, so it propagates.
 *  - Reminder: the agent's own AgentReminder; the bell rings when it's due.
 */
import { FormEvent, useMemo, useState } from 'react';
import { router } from '@inertiajs/react';
import { Spinner } from '@/Components/Skeleton';

type Listing = { id: number; label: string; type: string };

type Props = {
    listings: Listing[];
    view: 'day' | 'week' | 'month';
    cursor: string;
    /** Pre-fill the date (YYYY-MM-DD) — set when opened by clicking a calendar cell. */
    initialDate?: string;
    /** Pre-fill the time (HH:mm) — set when opened from a day-view hour slot. */
    initialTime?: string;
    initialKind?: Kind;
    onClose: () => void;
};

type Kind = 'viewing' | 'reminder';

function todayIso(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

export default function ScheduleViewingModal({ listings, view, cursor, initialDate, initialTime, initialKind = 'viewing', onClose }: Props) {
    const minDate = useMemo(() => todayIso(), []);
    const defaultDate = initialDate && initialDate >= minDate ? initialDate : minDate;
    const [kind, setKind] = useState<Kind>(initialKind);

    const [data, setDataState] = useState({
        listing_id:   '',
        name:         '',
        email:        '',
        phone:        '',
        date:         defaultDate,
        time:         initialTime ?? '10:00',
        message:      '',
        title:        '',
    });
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors]         = useState<Record<string, string>>({});

    function setData<K extends keyof typeof data>(key: K, value: (typeof data)[K]) {
        setDataState((d) => ({ ...d, [key]: value }));
    }

    function submit(e: FormEvent) {
        e.preventDefault();
        setProcessing(true);
        const opts = {
            onSuccess: () => onClose(),
            onError: (errs: Record<string, string>) => setErrors(errs),
            onFinish: () => setProcessing(false),
        };
        if (kind === 'reminder') {
            router.post('/agent/viewings/reminders', {
                title:     data.title,
                notes:     data.message,
                remind_at: `${data.date} ${data.time}:00`,
                view,
            }, opts);
            return;
        }
        router.post('/agent/viewings', {
            listing_id:   data.listing_id,
            name:         data.name,
            email:        data.email,
            phone:        data.phone,
            message:      data.message,
            scheduled_at: `${data.date} ${data.time}:00`,
            view,
            cursor,
        }, opts);
    }

    const scheduledAtError = (kind === 'reminder' ? errors.remind_at : errors.scheduled_at) as string | undefined;
    const canSubmit = kind === 'reminder'
        ? !! data.title && !! data.date && !! data.time
        : !! data.name && !! data.listing_id && !! data.date && !! data.time;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div
                className="bg-white rounded-xl shadow-lift max-w-lg w-full p-6 max-h-[92vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between mb-5">
                    <div>
                        <h2 className="text-lg font-bold">{kind === 'reminder' ? 'Add a reminder' : 'Schedule a viewing'}</h2>
                        <p className="text-[13px] text-ink-500 mt-1">
                            {kind === 'reminder'
                                ? "A note on your calendar. We'll ring your notification bell when it's due."
                                : "Book a property visit for a lead. They'll appear on your calendar."}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-ink-400 hover:text-ink-900 text-2xl leading-none -mt-1 -mr-1 p-1"
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                <div className="flex items-center bg-ink-50 border border-ink-200 rounded-lg p-1 mb-5" role="tablist">
                    {(['viewing', 'reminder'] as Kind[]).map((k) => (
                        <button
                            key={k}
                            type="button"
                            role="tab"
                            aria-selected={kind === k}
                            onClick={() => { setKind(k); setErrors({}); }}
                            className={`flex-1 text-[13px] px-3 py-1.5 rounded-md capitalize transition ${
                                kind === k ? 'bg-white shadow-soft font-semibold text-ink-900' : 'text-ink-500 hover:text-ink-900'
                            }`}
                        >
                            {k}
                        </button>
                    ))}
                </div>

                <form onSubmit={submit} className="space-y-4">
                    {kind === 'reminder' && (
                        <div>
                            <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">What to remember *</label>
                            <input
                                value={data.title}
                                onChange={(e) => setData('title', e.target.value)}
                                required
                                autoFocus
                                maxLength={160}
                                placeholder="e.g. Call Mrs Dlamini back about the valuation"
                                className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                            />
                            {errors.title && <p className="text-[11px] text-danger mt-1">{errors.title}</p>}
                        </div>
                    )}

                    {kind === 'viewing' && (
                    <div>
                        <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Property *</label>
                        <select
                            value={data.listing_id}
                            onChange={(e) => setData('listing_id', e.target.value)}
                            required
                            className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                        >
                            <option value="">Select a listing…</option>
                            {listings.map((l) => (
                                <option key={l.id} value={l.id}>{l.label}</option>
                            ))}
                        </select>
                        {errors.listing_id && <p className="text-[11px] text-danger mt-1">{errors.listing_id}</p>}
                    </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Date *</label>
                            <input
                                type="date"
                                min={minDate}
                                value={data.date}
                                onChange={(e) => setData('date', e.target.value)}
                                required
                                className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                            />
                        </div>
                        <div>
                            <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Time *</label>
                            <input
                                type="time"
                                value={data.time}
                                onChange={(e) => setData('time', e.target.value)}
                                required
                                className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                            />
                        </div>
                    </div>
                    {scheduledAtError && <p className="text-[11px] text-danger -mt-2">{scheduledAtError}</p>}

                    {kind === 'viewing' && (<>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Lead name *</label>
                            <input
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                required
                                placeholder="e.g. Tebogo Maseko"
                                className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                            />
                            {errors.name && <p className="text-[11px] text-danger mt-1">{errors.name}</p>}
                        </div>
                        <div>
                            <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Phone</label>
                            <input
                                value={data.phone}
                                onChange={(e) => setData('phone', e.target.value)}
                                placeholder="+27 82 555 1234"
                                className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                            />
                            {errors.phone && <p className="text-[11px] text-danger mt-1">{errors.phone}</p>}
                        </div>
                    </div>

                    <div>
                        <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Email</label>
                        <input
                            type="email"
                            value={data.email}
                            onChange={(e) => setData('email', e.target.value)}
                            placeholder="tebogo@example.com"
                            className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                        />
                        {errors.email && <p className="text-[11px] text-danger mt-1">{errors.email}</p>}
                    </div>
                    </>)}

                    <div>
                        <label className="text-[12px] font-semibold text-ink-700 mb-1.5 block">Notes</label>
                        <textarea
                            value={data.message}
                            onChange={(e) => setData('message', e.target.value)}
                            placeholder={kind === 'reminder' ? 'Optional details…' : "Meeting point, what they're looking for, anything else…"}
                            rows={3}
                            className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3.5 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand resize-none"
                        />
                        {(errors.message || errors.notes) && <p className="text-[11px] text-danger mt-1">{errors.message || errors.notes}</p>}
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-[13px] border border-ink-200 rounded-lg hover:bg-ink-100 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={processing || ! canSubmit}
                            className="px-4 py-2 text-[13px] bg-brand-700 text-white rounded-full hover:bg-brand-800 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2 font-semibold transition"
                        >
                            {processing && <Spinner size={13} />}
                            {processing ? 'Saving…' : kind === 'reminder' ? 'Add reminder' : 'Schedule viewing'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
