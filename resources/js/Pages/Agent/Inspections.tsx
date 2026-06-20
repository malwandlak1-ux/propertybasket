import { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import AgentLayout from '@/Layouts/AgentLayout';

type InspectionCard = {
    id: number;
    type: string;
    status: string;
    listing: string;
    tenant: string;
    date: string;
    rooms_total: number;
    rooms_done: number;
    pct: number;
    photo_count: number;
    deductions: number;
    deposit: number;
    color_class: string;
    agent_signed: boolean;
    tenant_signed: boolean;
    primary_image: string | null;
    view_url: string;
};

type UpcomingLease = {
    lease_id: number;
    listing: string;
    tenant: string;
    start_date: string;
};

type Props = {
    agent: { id: number; name: string; agency_name: string };
    move_in: InspectionCard[];
    move_out: InspectionCard[];
    upcoming: UpcomingLease[];
    counts: { move_in: number; move_out: number };
};

function fmtMoney(n: number): string {
    return 'R ' + Math.round(n).toLocaleString('en-ZA');
}

function statusBadge(status: string, hasDeductions: boolean) {
    if (hasDeductions) return { cls: 'bg-danger text-white', label: 'DEDUCTIONS FLAGGED' };
    switch (status) {
        case 'in_progress': return { cls: 'bg-brand-500 text-white', label: 'IN PROGRESS' };
        case 'completed':   return { cls: 'bg-success text-white',   label: 'COMPLETED' };
        case 'scheduled':   return { cls: 'bg-brand-500 text-white', label: 'SCHEDULED' };
        default:            return { cls: 'bg-warning text-white',   label: 'AWAITING SIGNATURE' };
    }
}

function borderClass(status: string, hasDeductions: boolean): string {
    if (hasDeductions) return 'border-2 border-danger/40';
    if (status === 'in_progress') return 'border-2 border-brand-500';
    if (status === 'scheduled') return 'border border-brand-200';
    return 'border border-ink-200';
}

function InspectionCardView({ card }: { card: InspectionCard }) {
    const hasDeductions = card.type === 'move_out' && card.deductions > 0;
    const badge = statusBadge(card.status, hasDeductions);
    const border = borderClass(card.status, hasDeductions);
    const isSigned = card.agent_signed && card.tenant_signed;

    return (
        <Link href={card.view_url} className={`bg-white rounded-xl overflow-hidden shadow-soft cursor-pointer hover:shadow-lift transition block ${border}`}>
            <div className={`aspect-[4/3] relative overflow-hidden ${card.primary_image ? '' : `bg-gradient-to-br ${card.color_class}`}`}>
                {card.primary_image && (
                    <img
                        src={card.primary_image}
                        alt={card.listing}
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                    />
                )}
                <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
                    <span className={`text-[10px] px-2 py-1 rounded-md font-bold ${badge.cls}`}>
                        {badge.label}
                    </span>
                    {isSigned && (
                        <span className="text-[10px] bg-white/90 backdrop-blur px-2 py-1 rounded-md font-bold">✍ SIGNED</span>
                    )}
                </div>

                {/* Progress or deposit info */}
                {card.status === 'in_progress' && card.rooms_total > 0 && (
                    <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur rounded-md p-2">
                        <p className="text-[12px] font-semibold">{card.rooms_done} of {card.rooms_total} rooms · {card.pct}%</p>
                        <div className="h-1.5 bg-ink-100 rounded-full mt-1.5 overflow-hidden">
                            <div className="h-full bg-brand-500 transition-all" style={{ width: `${card.pct}%` }} />
                        </div>
                    </div>
                )}

                {card.type === 'move_out' && card.deposit > 0 && (
                    <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur rounded-md p-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold">Deposit held</span>
                            <span className="text-[12px] font-mono font-bold">{fmtMoney(card.deposit)}</span>
                        </div>
                        {card.deductions > 0 && (
                            <div className="flex items-center justify-between mt-0.5">
                                <span className="text-[11px] text-danger font-semibold">Damage est.</span>
                                <span className="text-[12px] font-mono font-bold text-danger">- {fmtMoney(card.deductions)}</span>
                            </div>
                        )}
                    </div>
                )}

                {card.photo_count > 0 && card.status === 'completed' && (
                    <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur rounded-md px-2 py-1">
                        <p className="text-[10px] font-bold">📸 {card.photo_count} photos</p>
                    </div>
                )}
            </div>

            <div className="p-4">
                <p className="text-[14px] font-bold truncate">{card.listing}</p>
                <p className="text-[11px] text-ink-500 mb-3">
                    {card.tenant} · {card.type === 'move_in' ? 'MOVE-IN' : 'MOVE-OUT'}
                </p>
                <div className="flex items-center justify-between text-[11px] text-ink-500 pt-3 border-t border-ink-100">
                    <span>📅 {card.date}</span>
                    {card.status === 'in_progress' && (
                        <span className="text-brand-600 font-semibold">Continue →</span>
                    )}
                    {card.status === 'completed' && isSigned && (
                        <a
                            href={`/agent/inspections/${card.id}/pdf?download=1`}
                            target="_blank"
                            rel="noopener"
                            onClick={(e) => e.stopPropagation()}
                            className="text-brand-600 font-semibold hover:underline"
                        >
                            📄 PDF ↓
                        </a>
                    )}
                    {card.status === 'completed' && !isSigned && (
                        <span className="text-warning font-semibold">Send reminder →</span>
                    )}
                    {hasDeductions && (
                        <span className="text-danger font-semibold">Review →</span>
                    )}
                </div>
            </div>
        </Link>
    );
}

export default function AgentInspections({ agent, move_in, move_out, upcoming, counts }: Props) {
    const [tab, setTab] = useState<'move_in' | 'move_out'>('move_in');

    const list = tab === 'move_in' ? move_in : move_out;

    return (
        <AgentLayout crumb="Inspections" agencyName={agent.agency_name}>
            <Head title="Inspections" />

            <div className="px-4 sm:px-8 py-6 sm:py-7">
                {/* Header */}
                <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Inspections</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            Document property condition at move-in and move-out. Reports auto-emailed to tenant &amp; landlord.
                        </p>
                    </div>
                    <Link
                        href={`/agent/inspections/create?type=${tab}`}
                        className="px-3.5 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-brand-500 transition flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg>
                        New Inspection
                    </Link>
                </div>

                {/* Tab toggle */}
                <div className="flex items-center gap-1 mb-6 bg-white border border-ink-200 rounded-lg p-1 w-fit">
                    <button
                        onClick={() => setTab('move_in')}
                        className={`text-[13px] px-4 py-2 rounded-md font-semibold flex items-center gap-2 transition ${
                            tab === 'move_in' ? 'bg-ink-900 text-white' : 'text-ink-500 hover:bg-ink-100'
                        }`}
                    >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <path d="M9 22V12h6v10" />
                        </svg>
                        Move-in Inspections
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === 'move_in' ? 'bg-white/20' : 'bg-ink-100 text-ink-700'}`}>
                            {counts.move_in}
                        </span>
                    </button>
                    <button
                        onClick={() => setTab('move_out')}
                        className={`text-[13px] px-4 py-2 rounded-md font-semibold flex items-center gap-2 transition ${
                            tab === 'move_out' ? 'bg-ink-900 text-white' : 'text-ink-500 hover:bg-ink-100'
                        }`}
                    >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                        </svg>
                        Move-out Inspections
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === 'move_out' ? 'bg-white/20' : 'bg-ink-100 text-ink-700'}`}>
                            {counts.move_out}
                        </span>
                    </button>
                </div>

                {/* Upcoming leases banner (move-in tab only) */}
                {tab === 'move_in' && upcoming.length > 0 && (
                    <div className="bg-gradient-to-r from-brand-50 to-brand-100 border border-brand-100 rounded-xl p-4 mb-6">
                        {upcoming.map((lease) => (
                            <div key={lease.lease_id} className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg bg-brand-500 flex items-center justify-center text-white shrink-0">
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M12 8v4M12 16h.01" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <p className="text-[13px] font-semibold">Inspection due — lease starts {lease.start_date}</p>
                                    <p className="text-[12px] text-ink-500">{lease.tenant} · {lease.listing}</p>
                                </div>
                                <Link
                                    href={`/agent/inspections/create?type=move_in&lease=${lease.lease_id}`}
                                    className="px-3 py-1.5 text-[12px] bg-ink-900 text-white rounded-md font-semibold"
                                >
                                    Start inspection
                                </Link>
                            </div>
                        ))}
                    </div>
                )}

                {/* Move-out action banner */}
                {tab === 'move_out' && (
                    <div className="bg-gradient-to-r from-warning/10 to-amber-50 border border-warning/30 rounded-xl p-4 mb-6 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-warning flex items-center justify-center text-white shrink-0">
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <p className="text-[13px] font-semibold">Release deposits within the legal 14-day window</p>
                            <p className="text-[12px] text-ink-500">CPA / Rental Housing Act compliance — schedule move-out inspections for expiring leases.</p>
                        </div>
                        <button className="px-3 py-1.5 text-[12px] bg-ink-900 text-white rounded-md font-semibold">Schedule</button>
                    </div>
                )}

                {/* Inspection cards */}
                {list.length === 0 ? (
                    <div className="bg-white rounded-xl border border-ink-200 p-16 text-center shadow-soft">
                        <div className="w-12 h-12 rounded-xl bg-ink-100 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M9 12l2 2 4-4" />
                                <path d="M21 12c0 1-1 11-9 11s-9-10-9-11V5l9-3 9 3z" />
                            </svg>
                        </div>
                        <p className="text-[15px] font-semibold text-ink-700 mb-1">No {tab === 'move_in' ? 'move-in' : 'move-out'} inspections yet</p>
                        <p className="text-[13px] text-ink-500">Inspections you conduct will appear here.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {list.map((card) => (
                            <InspectionCardView key={card.id} card={card} />
                        ))}
                    </div>
                )}

                {/* Move-out comparison notice */}
                {tab === 'move_out' && move_out.some(c => c.deductions > 0) && (
                    <div className="mt-6 bg-white rounded-xl border border-ink-200 shadow-soft p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="text-[10px] bg-danger text-white px-2 py-0.5 rounded-md font-bold">DEDUCTIONS FLAGGED</span>
                            <h2 className="text-base font-bold">Move-out Comparison</h2>
                        </div>
                        <p className="text-[13px] text-ink-500">
                            Open a deduction-flagged inspection above to view the side-by-side move-in vs move-out photo comparison and confirm or dispute deductions.
                        </p>
                        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 divide-x divide-ink-200 border border-ink-200 rounded-lg overflow-hidden bg-ink-50/40">
                            {move_out.filter(c => c.deductions > 0).slice(0, 1).map(c => (
                                <>
                                    <div key="rooms" className="p-4">
                                        <p className="text-[10px] text-ink-500 uppercase tracking-wider font-semibold">Rooms with Issues</p>
                                        <p className="text-base font-bold mt-1 text-danger">—</p>
                                    </div>
                                    <div key="deposit" className="p-4">
                                        <p className="text-[10px] text-ink-500 uppercase tracking-wider font-semibold">Deposit Held</p>
                                        <p className="text-base font-bold mt-1">{fmtMoney(c.deposit)}</p>
                                    </div>
                                    <div key="deductions" className="p-4 bg-warning/5">
                                        <p className="text-[10px] text-warning uppercase tracking-wider font-semibold">Est. Deductions</p>
                                        <p className="text-base font-bold mt-1 text-danger">{fmtMoney(c.deductions)}</p>
                                    </div>
                                    <div key="net" className="p-4">
                                        <p className="text-[10px] text-ink-500 uppercase tracking-wider font-semibold">Net Refund</p>
                                        <p className="text-base font-bold mt-1 text-success">{fmtMoney(c.deposit - c.deductions)}</p>
                                    </div>
                                </>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </AgentLayout>
    );
}
