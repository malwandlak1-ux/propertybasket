import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import AgentLayout from '@/Layouts/AgentLayout';
import ScheduleViewingModal from '@/Components/ScheduleViewingModal';
import LeadDetailsModal, { Lead } from '@/Components/LeadDetailsModal';

type ViewMode = 'day' | 'week' | 'month';

type Viewing = {
    id: number;
    name: string;
    initials: string;
    date: string;          // YYYY-MM-DD
    day_index: number;     // 0=Mon … 6=Sun
    day_offset: number;    // days from period_start
    time: string;          // HH:mm
    hour: number;
    minute: number;
    listing: string;
    status: string;
    type: string;
    lead: Lead;
};

type DayMeta = {
    label: string;
    weekday: string;
    date: number;
    iso: string;
    is_today: boolean;
    in_period: boolean;
};

type Upcoming = { id: number; name: string; time: string; listing: string; lead: Lead };

type Reminder = {
    id: number;
    title: string;
    notes: string | null;
    date: string;          // YYYY-MM-DD
    time: string;          // HH:mm
    hour: number;
    done: boolean;
    when?: string;         // "Tue 10 Nov · 09:00" (upcoming list only)
};
type Listing = { id: number; label: string; type: string };

type Props = {
    agent: { id: number; name: string; agency_name: string };
    view: ViewMode;
    cursor: string;
    period_label: string;
    period_start: string;
    period_end: string;
    prev_cursor: string;
    next_cursor: string;
    today_cursor: string;
    days: DayMeta[];
    viewings: Viewing[];
    upcoming: Upcoming[];
    reminders: Reminder[];
    upcoming_reminders: Reminder[];
    listings: Listing[];
    total_in_period: number;
};

const STATUS_COLOR: Record<string, string> = {
    viewing:   'bg-brand-500',
    qualified: 'bg-sky-500',
    offer:     'bg-warning',
    closed:    'bg-success',
    disqualified: 'bg-ink-400',
};

/**
 * Click handler for an entry that sits inside a clickable day/slot cell:
 * opens the lead popup without also triggering "schedule a viewing here".
 */
function entryProps(v: Viewing, onOpen: (v: Viewing) => void) {
    return {
        role: 'button' as const,
        tabIndex: 0,
        title: `${v.time} · ${v.name} — view details`,
        onClick: (e: React.MouseEvent) => { e.stopPropagation(); onOpen(v); },
        onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onOpen(v); }
        },
    };
}

function ReminderChip({ r, onOpen, size }: { r: Reminder; onOpen: (r: Reminder) => void; size: 'day' | 'week' | 'month' }) {
    const pad = size === 'day' ? 'px-3 py-2 text-[12px]' : size === 'week' ? 'p-1.5 text-[10px]' : 'px-1.5 py-0.5 text-[9px] leading-tight';
    return (
        <div
            role="button"
            tabIndex={0}
            title={`${r.time} · ${r.title} — reminder`}
            onClick={(e) => { e.stopPropagation(); onOpen(r); }}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onOpen(r); }
            }}
            className={`${pad} rounded-md border border-dashed border-warning bg-warning/10 text-ink-900 cursor-pointer hover:ring-2 hover:ring-ink-900/20 ${r.done ? 'opacity-50 line-through' : ''}`}
        >
            {size === 'month' ? (
                <span className="block truncate">{r.time} {r.title}</span>
            ) : (
                <>
                    <p className="font-bold">{r.time}{size === 'day' && ` · ${r.title}`}</p>
                    {size === 'week' && <p className="truncate">{r.title}</p>}
                    {size === 'day' && r.notes && <p className="opacity-80 truncate">{r.notes}</p>}
                </>
            )}
        </div>
    );
}

const DAY_HOUR_START = 7;
const DAY_HOUR_END   = 20; // inclusive

function navigate(view: ViewMode, cursor: string) {
    router.get(
        '/agent/viewings',
        { view, cursor },
        { preserveScroll: true, preserveState: true, replace: true, only: [
            'view', 'cursor', 'period_label', 'period_start', 'period_end',
            'prev_cursor', 'next_cursor', 'today_cursor',
            'days', 'viewings', 'upcoming', 'reminders', 'upcoming_reminders', 'total_in_period',
        ] },
    );
}

function firstName(name: string): string {
    const parts = name.trim().split(/\s+/);
    return parts[0] + (parts[1] ? ` ${parts[1][0]}.` : '');
}

export default function AgentViewings({
    agent, view, cursor, period_label, prev_cursor, next_cursor, today_cursor,
    days, viewings, upcoming, reminders, upcoming_reminders, listings, total_in_period,
}: Props) {
    const [modalOpen, setModalOpen]   = useState(false);
    const [modalDate, setModalDate]   = useState<string | undefined>(undefined);
    const [modalTime, setModalTime]   = useState<string | undefined>(undefined);
    const [activeLead, setActiveLead] = useState<Lead | null>(null);
    const [activeReminder, setActiveReminder] = useState<Reminder | null>(null);
    const openEntry = (v: { lead: Lead }) => setActiveLead(v.lead);
    const openReminder = (r: Reminder) => setActiveReminder(r);
    const remindersInPeriod = reminders.length;

    function openSchedule(prefillDate?: string, prefillTime?: string) {
        setModalDate(prefillDate);
        setModalTime(prefillTime);
        setModalOpen(true);
    }

    return (
        <AgentLayout crumb="Calendar" agencyName={agent.agency_name}>
            <Head title="Calendar" />

            <div className="px-4 sm:px-8 py-6 sm:py-7">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                    <div>
                        <h1 className="text-[28px] sm:text-[32px] leading-tight tracking-tight">Calendar</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            {period_label} · {total_in_period} {total_in_period === 1 ? 'viewing' : 'viewings'}
                            {remindersInPeriod > 0 && ` · ${remindersInPeriod} ${remindersInPeriod === 1 ? 'reminder' : 'reminders'}`}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Prev / Today / Next */}
                        <div className="flex items-center bg-white border border-ink-200 rounded-lg">
                            <button
                                onClick={() => navigate(view, prev_cursor)}
                                className="px-2.5 py-1.5 text-ink-600 hover:bg-ink-50 rounded-l-lg"
                                aria-label="Previous"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 18l-6-6 6-6" /></svg>
                            </button>
                            <button
                                onClick={() => navigate(view, today_cursor)}
                                className="px-3 py-1.5 text-[12px] text-ink-700 hover:bg-ink-50 border-x border-ink-200"
                            >
                                Today
                            </button>
                            <button
                                onClick={() => navigate(view, next_cursor)}
                                className="px-2.5 py-1.5 text-ink-600 hover:bg-ink-50 rounded-r-lg"
                                aria-label="Next"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 18l6-6-6-6" /></svg>
                            </button>
                        </div>

                        {/* View toggle */}
                        <div className="flex items-center bg-white border border-ink-200 rounded-lg p-1">
                            {(['day', 'week', 'month'] as ViewMode[]).map((v) => (
                                <button
                                    key={v}
                                    onClick={() => navigate(v, cursor)}
                                    className={`text-[12px] px-3 py-1.5 rounded-md capitalize transition ${
                                        view === v ? 'bg-ink-100 font-semibold text-ink-900' : 'text-ink-500 hover:bg-ink-50'
                                    }`}
                                >
                                    {v}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => openSchedule()}
                            className="px-3.5 py-2 text-[13px] bg-brand-700 text-white rounded-full hover:bg-brand-800 transition flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg>
                            New entry
                        </button>
                    </div>
                </div>

                {/* Calendar */}
                {view === 'day'   && <DayView   days={days} viewings={viewings} reminders={reminders} onSlotClick={openSchedule} onOpen={openEntry} onOpenReminder={openReminder} />}
                {view === 'week'  && <WeekView  days={days} viewings={viewings} reminders={reminders} onCellClick={openSchedule} onOpen={openEntry} onOpenReminder={openReminder} />}
                {view === 'month' && <MonthView days={days} viewings={viewings} reminders={reminders} onCellClick={openSchedule} onOpen={openEntry} onOpenReminder={openReminder} />}

                <div className="flex items-center gap-4 mt-3 text-[11px] text-ink-500">
                    <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-brand-500" />Viewing</span>
                    <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-dashed border-warning bg-warning/10" />Reminder</span>
                </div>

                {/* Upcoming reminders — only on day/week, where they're useful */}
                {view !== 'month' && upcoming_reminders.length > 0 && (
                    <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 mt-6">
                        <h2 className="text-base font-semibold mb-4">Upcoming Reminders</h2>
                        <div className="space-y-3">
                            {upcoming_reminders.map((r) => (
                                <button type="button" key={r.id} onClick={() => openReminder(r)} className="w-full text-left flex items-center gap-4 p-3 rounded-lg hover:bg-ink-50 border border-ink-100">
                                    <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                                        <svg className="w-5 h-5 text-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                            <path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9" />
                                            <path d="M10.3 21a1.94 1.94 0 003.4 0" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13px] font-semibold truncate">{r.title}</p>
                                        {r.notes && <p className="text-[11px] text-ink-500 truncate">{r.notes}</p>}
                                    </div>
                                    <span className="text-[12px] text-ink-600 font-mono whitespace-nowrap">{r.when}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Upcoming viewings — only on day/week, where they're useful */}
                {view !== 'month' && upcoming.length > 0 && (
                    <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft p-5 mt-6">
                        <h2 className="text-base font-semibold mb-4">Upcoming Viewings</h2>
                        <div className="space-y-3">
                            {upcoming.map((v) => (
                                <button type="button" key={v.id} onClick={() => openEntry(v)} className="w-full text-left flex items-center gap-4 p-3 rounded-lg hover:bg-ink-50 border border-ink-100">
                                    <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                                        <svg className="w-5 h-5 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                            <rect x="3" y="5" width="18" height="16" rx="2" />
                                            <path d="M16 3v4M8 3v4M3 10h18" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13px] font-semibold">{v.name}</p>
                                        <p className="text-[11px] text-ink-500 truncate">{v.listing}</p>
                                    </div>
                                    <span className="text-[12px] text-ink-600 font-mono whitespace-nowrap">{v.time}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {total_in_period === 0 && remindersInPeriod === 0 && view === 'day' && (
                    <div className="mt-4 text-center text-[13px] text-ink-500">
                        Nothing on this day. Click any time slot to add a viewing or reminder.
                    </div>
                )}
            </div>

            {activeLead && <LeadDetailsModal lead={activeLead} onClose={() => setActiveLead(null)} />}

            {activeReminder && <ReminderModal reminder={activeReminder} onClose={() => setActiveReminder(null)} />}

            {modalOpen && (
                <ScheduleViewingModal
                    listings={listings}
                    view={view}
                    cursor={cursor}
                    initialDate={modalDate}
                    initialTime={modalTime}
                    onClose={() => setModalOpen(false)}
                />
            )}
        </AgentLayout>
    );
}

/* ---------------- Reminder popup ---------------- */

function ReminderModal({ reminder, onClose }: { reminder: Reminder; onClose: () => void }) {
    const [busy, setBusy] = useState(false);
    const opts = { preserveScroll: true, onSuccess: onClose, onFinish: () => setBusy(false) };
    const when = new Date(`${reminder.date}T${reminder.time}`).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-4" onClick={onClose} role="dialog" aria-modal="true">
            <div className="bg-white rounded-xl shadow-lift max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-warning">Reminder{reminder.done && ' · done'}</p>
                        <h2 className={`text-lg font-bold mt-1 break-words ${reminder.done ? 'line-through text-ink-500' : ''}`}>{reminder.title}</h2>
                        <p className="text-[13px] text-ink-500 mt-1">{when} · {reminder.time}</p>
                    </div>
                    <button type="button" onClick={onClose} className="text-ink-400 hover:text-ink-900 text-2xl leading-none -mt-1 -mr-1 p-1" aria-label="Close">×</button>
                </div>

                {reminder.notes && <p className="text-[14px] text-ink-700 whitespace-pre-line mb-5">{reminder.notes}</p>}

                <div className="flex justify-between gap-2 pt-2">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => { if (confirm('Delete this reminder?')) { setBusy(true); router.delete(`/agent/viewings/reminders/${reminder.id}`, opts); } }}
                        className="px-4 py-2 text-[13px] rounded-full text-danger hover:bg-danger/10 disabled:opacity-60"
                    >
                        Delete
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => { setBusy(true); router.patch(`/agent/viewings/reminders/${reminder.id}`, {}, opts); }}
                        className="px-4 py-2 text-[13px] bg-brand-700 text-white rounded-full hover:bg-brand-800 disabled:opacity-60 font-semibold"
                    >
                        {reminder.done ? 'Mark not done' : 'Mark done'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ---------------- Day view ---------------- */

function DayView({ days, viewings, reminders, onSlotClick, onOpen, onOpenReminder }: { days: DayMeta[]; viewings: Viewing[]; reminders: Reminder[]; onSlotClick: (iso: string, time?: string) => void; onOpen: (v: Viewing) => void; onOpenReminder: (r: Reminder) => void }) {
    const dayIso = days[0]?.iso ?? '';

    return (
        <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden">
            <div className={`p-4 border-b border-ink-200 ${days[0]?.is_today ? 'bg-brand-50/40' : ''}`}>
                <p className="text-[11px] text-ink-500 uppercase tracking-wider font-semibold">{days[0]?.weekday}</p>
                <p className={`text-xl font-bold mt-0.5 ${days[0]?.is_today ? 'text-brand-600' : ''}`}>
                    {days[0]?.date}
                </p>
            </div>

            <div className="divide-y divide-ink-100">
                {Array.from({ length: DAY_HOUR_END - DAY_HOUR_START + 1 }, (_, i) => {
                    const hour = DAY_HOUR_START + i;
                    // Entries before/after the visible hours land in the first/last slot.
                    const inSlot = (h: number) => h === hour || (i === 0 && h < hour) || (hour === DAY_HOUR_END && h > hour);
                    const slotItems = viewings.filter((v) => inSlot(v.hour));
                    const slotReminders = reminders.filter((r) => inSlot(r.hour));

                    return (
                        <div key={hour} className="flex items-stretch group">
                            <div className="w-20 shrink-0 p-3 text-right text-[11px] text-ink-500 font-mono border-r border-ink-100 bg-ink-50/40">
                                {String(hour).padStart(2, '0')}:00
                            </div>
                            <button
                                onClick={() => onSlotClick(dayIso, `${String(hour).padStart(2, '0')}:00`)}
                                className="flex-1 min-h-[64px] p-2 text-left hover:bg-brand-50/40 transition"
                            >
                                {slotItems.length === 0 && slotReminders.length === 0 ? (
                                    <span className="opacity-0 group-hover:opacity-100 text-[11px] text-brand-600 transition">
                                        + Add viewing or reminder
                                    </span>
                                ) : (
                                    <div className="space-y-1.5">
                                        {slotItems.map((v) => (
                                            <div
                                                key={v.id}
                                                {...entryProps(v, onOpen)}
                                                className={`${STATUS_COLOR[v.status] ?? 'bg-brand-500'} text-white rounded-md px-3 py-2 text-[12px] cursor-pointer hover:ring-2 hover:ring-ink-900/20`}
                                            >
                                                <p className="font-bold">{v.time} · {v.name}</p>
                                                <p className="opacity-90 truncate">{v.listing}</p>
                                            </div>
                                        ))}
                                        {slotReminders.map((r) => <ReminderChip key={`r${r.id}`} r={r} onOpen={onOpenReminder} size="day" />)}
                                    </div>
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ---------------- Week view ---------------- */

function WeekView({ days, viewings, reminders, onCellClick, onOpen, onOpenReminder }: { days: DayMeta[]; viewings: Viewing[]; reminders: Reminder[]; onCellClick: (iso: string) => void; onOpen: (v: Viewing) => void; onOpenReminder: (r: Reminder) => void }) {
    const byIso: Record<string, Viewing[]> = {};
    viewings.forEach((v) => {
        (byIso[v.date] ??= []).push(v);
    });
    const remindersByIso: Record<string, Reminder[]> = {};
    reminders.forEach((r) => {
        (remindersByIso[r.date] ??= []).push(r);
    });

    return (
        <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden">
            <div className="overflow-x-auto"><div className="min-w-[640px]">
            <div className="grid grid-cols-7 border-b border-ink-200">
                {days.map((day, idx) => (
                    <div
                        key={day.iso}
                        className={`p-3 text-center ${idx < 6 ? 'border-r border-ink-200' : ''} ${day.is_today ? 'bg-brand-50/40' : ''}`}
                    >
                        <p className="text-[10px] text-ink-500 uppercase tracking-wider font-semibold">{day.label}</p>
                        <p className={`text-lg font-bold mt-0.5 ${day.is_today ? 'text-brand-600' : ''}`}>{day.date}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7">
                {days.map((day, idx) => {
                    const items = byIso[day.iso] ?? [];
                    const dayReminders = remindersByIso[day.iso] ?? [];
                    const isEmpty = items.length === 0 && dayReminders.length === 0;
                    return (
                        <button
                            key={day.iso}
                            onClick={() => onCellClick(day.iso)}
                            className={`min-h-[140px] p-2 space-y-1 text-left hover:bg-brand-50/30 transition ${idx < 6 ? 'border-r border-ink-100' : ''}`}
                            style={isEmpty ? {
                                backgroundImage: 'radial-gradient(circle, #E5E7EB 1px, transparent 1px)',
                                backgroundSize: '14px 14px',
                            } : {}}
                        >
                            {items.map((v) => (
                                <div
                                    key={v.id}
                                    {...entryProps(v, onOpen)}
                                    className={`${STATUS_COLOR[v.status] ?? 'bg-brand-500'} text-white rounded-md p-1.5 text-[10px] cursor-pointer hover:ring-2 hover:ring-ink-900/20`}
                                >
                                    <p className="font-bold">{v.time}</p>
                                    <p className="opacity-90 truncate">{firstName(v.name)}</p>
                                </div>
                            ))}
                            {dayReminders.map((r) => <ReminderChip key={`r${r.id}`} r={r} onOpen={onOpenReminder} size="week" />)}
                        </button>
                    );
                })}
            </div>
            </div></div>
        </div>
    );
}

/* ---------------- Month view ---------------- */

function MonthView({ days, viewings, reminders, onCellClick, onOpen, onOpenReminder }: { days: DayMeta[]; viewings: Viewing[]; reminders: Reminder[]; onCellClick: (iso: string) => void; onOpen: (v: Viewing) => void; onOpenReminder: (r: Reminder) => void }) {
    const byIso: Record<string, Viewing[]> = {};
    viewings.forEach((v) => {
        (byIso[v.date] ??= []).push(v);
    });
    const remindersByIso: Record<string, Reminder[]> = {};
    reminders.forEach((r) => {
        (remindersByIso[r.date] ??= []).push(r);
    });

    const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
        <div className="bg-white rounded-2xl border border-ink-200/60 shadow-soft overflow-hidden">
            <div className="overflow-x-auto"><div className="min-w-[640px]">
            <div className="grid grid-cols-7 border-b border-ink-200 bg-ink-50/40">
                {weekdayLabels.map((label, idx) => (
                    <div
                        key={label}
                        className={`p-2 text-center text-[10px] text-ink-500 uppercase tracking-wider font-semibold ${idx < 6 ? 'border-r border-ink-200' : ''}`}
                    >
                        {label}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 grid-rows-6">
                {days.map((day, idx) => {
                    const items = byIso[day.iso] ?? [];
                    const dayReminders = remindersByIso[day.iso] ?? [];
                    const shownReminders = dayReminders.slice(0, Math.max(0, 3 - items.length));
                    const hidden = Math.max(0, items.length - 3) + dayReminders.length - shownReminders.length;
                    const colIdx = idx % 7;
                    const rowIdx = Math.floor(idx / 7);
                    return (
                        <button
                            key={day.iso}
                            onClick={() => onCellClick(day.iso)}
                            className={`min-h-[96px] p-1.5 text-left hover:bg-brand-50/30 transition ${
                                colIdx < 6 ? 'border-r border-ink-100' : ''
                            } ${rowIdx < 5 ? 'border-b border-ink-100' : ''} ${
                                day.in_period ? '' : 'bg-ink-50/40 text-ink-400'
                            }`}
                        >
                            <p
                                className={`text-[12px] font-semibold mb-1 ${
                                    day.is_today
                                        ? 'inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-500 text-white'
                                        : day.in_period
                                          ? 'text-ink-700'
                                          : 'text-ink-400'
                                }`}
                            >
                                {day.date}
                            </p>

                            <div className="space-y-0.5">
                                {items.slice(0, 3).map((v) => (
                                    <div
                                        key={v.id}
                                        {...entryProps(v, onOpen)}
                                        className={`${STATUS_COLOR[v.status] ?? 'bg-brand-500'} text-white rounded px-1.5 py-0.5 text-[9px] leading-tight truncate cursor-pointer hover:ring-2 hover:ring-ink-900/20`}
                                    >
                                        {v.time} {firstName(v.name)}
                                    </div>
                                ))}
                                {shownReminders.map((r) => <ReminderChip key={`r${r.id}`} r={r} onOpen={onOpenReminder} size="month" />)}
                                {hidden > 0 && (
                                    <p className="text-[9px] text-ink-500 font-semibold pl-1">+{hidden} more</p>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
            </div></div>
        </div>
    );
}
