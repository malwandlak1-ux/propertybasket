import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import AgentLayout from '@/Layouts/AgentLayout';
import ScheduleViewingModal from '@/Components/ScheduleViewingModal';

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
};

type DayMeta = {
    label: string;
    weekday: string;
    date: number;
    iso: string;
    is_today: boolean;
    in_period: boolean;
};

type Upcoming = { id: number; name: string; time: string; listing: string };
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
    listings: Listing[];
    total_in_period: number;
};

const STATUS_COLOR: Record<string, string> = {
    viewing:   'bg-brand-500',
    qualified: 'bg-sky-500',
    offer:     'bg-warning',
    closed:    'bg-success',
};

const DAY_HOUR_START = 7;
const DAY_HOUR_END   = 20; // inclusive

function navigate(view: ViewMode, cursor: string) {
    router.get(
        '/agent/viewings',
        { view, cursor },
        { preserveScroll: true, preserveState: true, replace: true, only: [
            'view', 'cursor', 'period_label', 'period_start', 'period_end',
            'prev_cursor', 'next_cursor', 'today_cursor',
            'days', 'viewings', 'upcoming', 'total_in_period',
        ] },
    );
}

function firstName(name: string): string {
    const parts = name.trim().split(/\s+/);
    return parts[0] + (parts[1] ? ` ${parts[1][0]}.` : '');
}

export default function AgentViewings({
    agent, view, cursor, period_label, prev_cursor, next_cursor, today_cursor,
    days, viewings, upcoming, listings, total_in_period,
}: Props) {
    const [modalOpen, setModalOpen]   = useState(false);
    const [modalDate, setModalDate]   = useState<string | undefined>(undefined);

    function openSchedule(prefillDate?: string) {
        setModalDate(prefillDate);
        setModalOpen(true);
    }

    return (
        <AgentLayout crumb="Viewings" agencyName={agent.agency_name}>
            <Head title="Viewings Calendar" />

            <div className="px-4 sm:px-8 py-6 sm:py-7">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Viewings Calendar</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            {period_label} · {total_in_period} {total_in_period === 1 ? 'viewing' : 'viewings'}
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
                            className="px-3.5 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-ink-800 transition flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg>
                            Schedule
                        </button>
                    </div>
                </div>

                {/* Calendar */}
                {view === 'day'   && <DayView   days={days} viewings={viewings} onSlotClick={openSchedule} />}
                {view === 'week'  && <WeekView  days={days} viewings={viewings} onCellClick={openSchedule} />}
                {view === 'month' && <MonthView days={days} viewings={viewings} onCellClick={openSchedule} />}

                {/* Upcoming viewings — only on day/week, where they're useful */}
                {view !== 'month' && upcoming.length > 0 && (
                    <div className="bg-white rounded-xl border border-ink-200 shadow-soft p-5 mt-6">
                        <h2 className="text-base font-semibold mb-4">Upcoming Viewings</h2>
                        <div className="space-y-3">
                            {upcoming.map((v) => (
                                <div key={v.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-ink-50 border border-ink-100">
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
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {total_in_period === 0 && view === 'day' && (
                    <div className="mt-4 text-center text-[13px] text-ink-500">
                        No viewings on this day. Click any time slot to schedule one.
                    </div>
                )}
            </div>

            {modalOpen && (
                <ScheduleViewingModal
                    listings={listings}
                    view={view}
                    cursor={cursor}
                    initialDate={modalDate}
                    onClose={() => setModalOpen(false)}
                />
            )}
        </AgentLayout>
    );
}

/* ---------------- Day view ---------------- */

function DayView({ days, viewings, onSlotClick }: { days: DayMeta[]; viewings: Viewing[]; onSlotClick: (iso: string) => void }) {
    const dayIso = days[0]?.iso ?? '';

    return (
        <div className="bg-white rounded-xl border border-ink-200 shadow-soft overflow-hidden">
            <div className={`p-4 border-b border-ink-200 ${days[0]?.is_today ? 'bg-brand-50/40' : ''}`}>
                <p className="text-[11px] text-ink-500 uppercase tracking-wider font-semibold">{days[0]?.weekday}</p>
                <p className={`text-xl font-bold mt-0.5 ${days[0]?.is_today ? 'text-brand-600' : ''}`}>
                    {days[0]?.date}
                </p>
            </div>

            <div className="divide-y divide-ink-100">
                {Array.from({ length: DAY_HOUR_END - DAY_HOUR_START + 1 }, (_, i) => {
                    const hour = DAY_HOUR_START + i;
                    const slotItems = viewings.filter((v) => v.hour === hour);

                    return (
                        <div key={hour} className="flex items-stretch group">
                            <div className="w-20 shrink-0 p-3 text-right text-[11px] text-ink-500 font-mono border-r border-ink-100 bg-ink-50/40">
                                {String(hour).padStart(2, '0')}:00
                            </div>
                            <button
                                onClick={() => onSlotClick(dayIso)}
                                className="flex-1 min-h-[64px] p-2 text-left hover:bg-brand-50/40 transition"
                            >
                                {slotItems.length === 0 ? (
                                    <span className="opacity-0 group-hover:opacity-100 text-[11px] text-brand-600 transition">
                                        + Add viewing
                                    </span>
                                ) : (
                                    <div className="space-y-1.5">
                                        {slotItems.map((v) => (
                                            <div
                                                key={v.id}
                                                className={`${STATUS_COLOR[v.status] ?? 'bg-brand-500'} text-white rounded-md px-3 py-2 text-[12px]`}
                                            >
                                                <p className="font-bold">{v.time} · {v.name}</p>
                                                <p className="opacity-90 truncate">{v.listing}</p>
                                            </div>
                                        ))}
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

function WeekView({ days, viewings, onCellClick }: { days: DayMeta[]; viewings: Viewing[]; onCellClick: (iso: string) => void }) {
    const byIso: Record<string, Viewing[]> = {};
    viewings.forEach((v) => {
        (byIso[v.date] ??= []).push(v);
    });

    return (
        <div className="bg-white rounded-xl border border-ink-200 shadow-soft overflow-hidden">
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
                    const isEmpty = items.length === 0;
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
                                    className={`${STATUS_COLOR[v.status] ?? 'bg-brand-500'} text-white rounded-md p-1.5 text-[10px]`}
                                >
                                    <p className="font-bold">{v.time}</p>
                                    <p className="opacity-90 truncate">{firstName(v.name)}</p>
                                </div>
                            ))}
                        </button>
                    );
                })}
            </div>
            </div></div>
        </div>
    );
}

/* ---------------- Month view ---------------- */

function MonthView({ days, viewings, onCellClick }: { days: DayMeta[]; viewings: Viewing[]; onCellClick: (iso: string) => void }) {
    const byIso: Record<string, Viewing[]> = {};
    viewings.forEach((v) => {
        (byIso[v.date] ??= []).push(v);
    });

    const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
        <div className="bg-white rounded-xl border border-ink-200 shadow-soft overflow-hidden">
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
                                        className={`${STATUS_COLOR[v.status] ?? 'bg-brand-500'} text-white rounded px-1.5 py-0.5 text-[9px] leading-tight truncate`}
                                    >
                                        {v.time} {firstName(v.name)}
                                    </div>
                                ))}
                                {items.length > 3 && (
                                    <p className="text-[9px] text-ink-500 font-semibold pl-1">+{items.length - 3} more</p>
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
