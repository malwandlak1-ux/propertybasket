import { useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import AgencyLayout from '@/Layouts/AgencyLayout';

type Agent = { id: number; name: string };

type Card = {
    id: number;
    slug: string;
    title: string;
    suburb: string | null;
    city: string | null;
    listing_type: 'for_sale' | 'long_term_rent' | 'short_term_stay';
    primary_image: string | null;
    price_label: string;
    agent: { id: number; name: string; initials: string; split: number | null } | null;
    stats: { inquiries: number; viewings: number; offers: number };
};

type Lead = {
    id: number;
    visitor_name: string;
    listing_title: string | null;
    source: string;
    agent: { id: number | null; name: string | null; initials: string };
    allocation_method: 'round_robin' | 'manual' | null;
    status: string;
    created_at: string | null;
};

type Props = {
    agency: { id: number; name: string };
    cards: Card[];
    agents: Agent[];
    next_up: { id: number; name: string } | null;
    lead_queue: Lead[];
    totals: { listings: number; unassigned: number; agents: number };
};

type SharedProps = { flash?: { success?: string | null; error?: string | null } };

const TYPE_BADGE: Record<Card['listing_type'], string> = {
    for_sale: 'FOR SALE',
    long_term_rent: 'FOR RENT',
    short_term_stay: 'SHORT-STAY',
};
const TYPE_GRADIENT: Record<Card['listing_type'], string> = {
    for_sale: 'linear-gradient(135deg,#7DD3FC,#0EA5E9)',
    long_term_rent: 'linear-gradient(135deg,#FCD34D,#F97316)',
    short_term_stay: 'linear-gradient(135deg,#FDA4AF,#EC4899)',
};

const SOURCE_COLOURS: Record<string, string> = {
    website: 'bg-brand-50 text-brand-700',
    property24: 'bg-sky-50 text-sky-700',
    private_property: 'bg-violet-50 text-violet-700',
    referral: 'bg-emerald-50 text-success',
    walkin: 'bg-amber-50 text-warning',
};
const SOURCE_LABEL: Record<string, string> = {
    website: 'Property Basket',
    property24: 'Property24',
    private_property: 'Private Property',
    referral: 'Referral',
    walkin: 'Walk-in',
};

const STATUS_COLOURS: Record<string, string> = {
    new: 'bg-success/15 text-success',
    contacted: 'bg-ink-100 text-ink-700',
    qualified: 'bg-brand-50 text-brand-700',
    viewing: 'bg-brand-50 text-brand-700',
    offer: 'bg-warning/15 text-warning',
    closed: 'bg-success/15 text-success',
    lost: 'bg-ink-100 text-ink-500',
};

function gradientForAgent(id: number | null): string {
    const palette = [
        'linear-gradient(135deg,#5B3DF5,#3A23B8)',
        'linear-gradient(135deg,#F472B6,#E11D48)',
        'linear-gradient(135deg,#38BDF8,#0284C7)',
        'linear-gradient(135deg,#34D399,#059669)',
        'linear-gradient(135deg,#FBBF24,#D97706)',
        'linear-gradient(135deg,#A78BFA,#7C3AED)',
    ];
    return palette[(id ?? 0) % palette.length];
}

export default function ListingsAllocation({ agency, cards, agents, next_up, lead_queue, totals }: Props) {
    const { flash } = usePage<SharedProps>().props;

    return (
        <AgencyLayout agencyName={agency.name} crumb="Listings & Leads">
            <Head title="Listings & Leads" />
            <section className="px-8 py-7">
                <div className="flex items-end justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Listings &amp; Lead Allocation</h1>
                        <p className="text-[14px] text-ink-500 mt-1">
                            {totals.listings} active listing{totals.listings === 1 ? '' : 's'} ·{' '}
                            <span className="font-semibold text-ink-900">Round-robin</span> across {totals.agents} agents
                            {totals.unassigned > 0 && (
                                <> · <span className="text-warning font-semibold">{totals.unassigned} awaiting allocation</span></>
                            )}
                        </p>
                    </div>
                    <Link
                        href="/agency/listings/create"
                        className="px-3.5 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-ink-800 flex items-center gap-2 transition"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                        New Listing
                    </Link>
                </div>

                {flash?.success && (
                    <div className="mb-4 rounded-lg bg-success/10 border border-success/30 text-success px-4 py-3 text-[13px]">
                        {flash.success}
                    </div>
                )}
                {flash?.error && (
                    <div className="mb-4 rounded-lg bg-danger/10 border border-danger/30 text-danger px-4 py-3 text-[13px]">
                        {flash.error}
                    </div>
                )}

                {/* Allocation rule banner */}
                <div
                    className="rounded-xl p-4 mb-6 flex items-center gap-4 border border-brand-100"
                    style={{ background: 'linear-gradient(90deg,#F2EFFE,#EEF2FF)' }}
                >
                    <div className="w-10 h-10 rounded-lg bg-brand-500 flex items-center justify-center text-white">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M3 12a9 9 0 1 0 9-9M21 3v6h-6M21 12a9 9 0 0 1-9 9m-9-9h6M12 8v4l3 2" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <p className="text-[13px] font-semibold">Round-robin allocation is ON</p>
                        <p className="text-[12px] text-ink-500">
                            New leads rotate evenly across active agents. Manual override available per lead.
                        </p>
                    </div>
                    <p className="text-[11px] text-ink-500 font-mono">
                        Next up:{' '}
                        <span className="font-bold text-brand-700">
                            {next_up?.name ?? 'No active agents'}
                        </span>
                    </p>
                    <a
                        href="/agency/settings"
                        className="px-3 py-1.5 text-[12px] bg-white border border-ink-200 rounded-md hover:bg-ink-100"
                    >
                        Configure
                    </a>
                </div>

                {/* Listing cards */}
                <div className="grid grid-cols-3 gap-4">
                    {cards.length === 0 ? (
                        <div className="col-span-3 bg-white rounded-xl border border-ink-200 p-12 text-center text-ink-500">
                            No agency listings yet.
                        </div>
                    ) : (
                        cards.map((c) => (
                            <ListingCardItem key={c.id} card={c} agents={agents} />
                        ))
                    )}
                </div>

                {/* Lead queue */}
                <div className="mt-6 bg-white rounded-xl border border-ink-200 shadow-soft overflow-hidden">
                    <div className="p-5 border-b border-ink-200 flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-semibold">Lead Queue · Round-robin distribution</h2>
                            <p className="text-[12px] text-ink-500 mt-0.5">Most recent leads · Auto-assigned</p>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-[11px] uppercase text-ink-500 tracking-wider border-b border-ink-200 bg-ink-50">
                                    <th className="font-semibold px-5 py-3">Lead</th>
                                    <th className="font-semibold py-3">Property</th>
                                    <th className="font-semibold py-3">Source</th>
                                    <th className="font-semibold py-3">Assigned to</th>
                                    <th className="font-semibold py-3">Status</th>
                                    <th className="font-semibold py-3 text-right pr-5">Received</th>
                                </tr>
                            </thead>
                            <tbody className="text-[13px]">
                                {lead_queue.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-10 text-center text-ink-500">No leads yet.</td>
                                    </tr>
                                ) : (
                                    lead_queue.map((l) => <LeadRow key={l.id} lead={l} agents={agents} />)
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </AgencyLayout>
    );
}

function ListingCardItem({ card, agents }: { card: Card; agents: Agent[] }) {
    const [editing, setEditing] = useState(false);
    const [agentId, setAgentId] = useState<number | ''>('');

    function assign() {
        router.post(`/agency/listings/${card.id}/assign`, { agent_id: agentId }, {
            preserveScroll: true,
            onSuccess: () => setEditing(false),
        });
    }
    function autoAssign() {
        router.post(`/agency/listings/${card.id}/auto-assign`, {}, {
            preserveScroll: true,
            onSuccess: () => setEditing(false),
        });
    }

    const unassigned = card.agent === null;

    return (
        <div
            className={
                'bg-white rounded-xl overflow-hidden shadow-soft border ' +
                (unassigned ? 'border-warning/40' : 'border-ink-200')
            }
        >
            <div
                className="aspect-[4/3] relative"
                style={
                    card.primary_image
                        ? {
                              backgroundImage: `url(${card.primary_image})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                          }
                        : { background: TYPE_GRADIENT[card.listing_type] }
                }
            >
                <div className="absolute top-3 left-3 flex gap-1.5">
                    <span className="text-[10px] bg-white/90 backdrop-blur px-2 py-1 rounded-md font-bold">
                        {TYPE_BADGE[card.listing_type]}
                    </span>
                    {unassigned && (
                        <span className="text-[10px] bg-warning text-white px-2 py-1 rounded-md font-bold">UNASSIGNED</span>
                    )}
                </div>
            </div>
            <div className="p-4">
                <p className="text-[15px] font-bold line-clamp-1">{card.title}</p>
                <p className="text-[12px] text-ink-500 mb-3">
                    {[card.suburb, card.city].filter(Boolean).join(', ') || '—'} · {card.price_label}
                </p>

                {!unassigned && !editing && card.agent && (
                    <div className="bg-ink-50 rounded-lg p-3 mb-3">
                        <p className="text-[10px] text-ink-500 uppercase tracking-wider font-semibold mb-2">Assigned agent</p>
                        <div className="flex items-center gap-2">
                            <div
                                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                                style={{ background: gradientForAgent(card.agent.id) }}
                            >
                                {card.agent.initials || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-semibold truncate">{card.agent.name}</p>
                                {card.agent.split !== null && (
                                    <p className="text-[10px] text-ink-500">Split: {card.agent.split}/{100 - card.agent.split}</p>
                                )}
                            </div>
                            <button
                                onClick={() => {
                                    setAgentId(card.agent?.id ?? '');
                                    setEditing(true);
                                }}
                                className="text-[10px] text-brand-600 font-semibold"
                            >
                                Change
                            </button>
                        </div>
                    </div>
                )}

                {(unassigned || editing) && (
                    <div
                        className={
                            'rounded-lg p-3 mb-3 ' +
                            (unassigned ? 'bg-warning/5 border border-warning/30' : 'bg-ink-50 border border-ink-200')
                        }
                    >
                        <p className={
                            'text-[10px] uppercase tracking-wider font-semibold mb-2 ' +
                            (unassigned ? 'text-warning' : 'text-ink-500')
                        }>
                            {unassigned ? 'Awaiting allocation' : 'Reassign agent'}
                        </p>
                        <div className="flex items-center gap-2">
                            <select
                                value={agentId}
                                onChange={(e) => setAgentId(e.target.value === '' ? '' : Number(e.target.value))}
                                className="flex-1 text-[12px] bg-white border border-ink-200 rounded-md px-2 py-1.5"
                            >
                                <option value="">— pick an agent —</option>
                                {agents.map((a) => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                            </select>
                            <button
                                onClick={assign}
                                disabled={agentId === ''}
                                className="px-3 py-1.5 text-[11px] bg-brand-500 text-white rounded-md font-semibold disabled:opacity-40"
                            >
                                {editing && !unassigned ? 'Save' : 'Assign'}
                            </button>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                            {editing && !unassigned && (
                                <button onClick={() => setEditing(false)} className="text-[11px] text-ink-500 hover:underline">
                                    Cancel
                                </button>
                            )}
                            {unassigned && (
                                <button onClick={autoAssign} className="text-[11px] text-brand-700 font-semibold hover:underline ml-auto">
                                    Auto-assign (round-robin) →
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-3 gap-2 text-center">
                    <Tile value={card.stats.inquiries} label="Inquiries" />
                    <Tile value={card.stats.viewings} label="Viewings" />
                    <Tile value={card.stats.offers} label="Offers" />
                </div>
            </div>
        </div>
    );
}

function Tile({ value, label }: { value: number; label: string }) {
    return (
        <div className="bg-ink-50 rounded p-1.5">
            <p className="text-[11px] font-bold">{value}</p>
            <p className="text-[9px] text-ink-500">{label}</p>
        </div>
    );
}

function LeadRow({ lead, agents }: { lead: Lead; agents: Agent[] }) {
    const [editing, setEditing] = useState(false);
    const [agentId, setAgentId] = useState<number | ''>(lead.agent.id ?? '');

    function save() {
        router.post(`/agency/leads/${lead.id}/reassign`, { agent_id: agentId }, {
            preserveScroll: true,
            onSuccess: () => setEditing(false),
        });
    }

    const sourceCls = SOURCE_COLOURS[lead.source] ?? 'bg-ink-100 text-ink-700';
    const sourceLabel = SOURCE_LABEL[lead.source] ?? lead.source;
    const statusCls = STATUS_COLOURS[lead.status] ?? 'bg-ink-100 text-ink-700';

    return (
        <tr className="border-b border-ink-100 hover:bg-ink-50">
            <td className="px-5 py-3 font-semibold">{lead.visitor_name}</td>
            <td className="text-ink-700">{lead.listing_title ?? '—'}</td>
            <td>
                <span className={'text-[11px] px-2 py-0.5 rounded-full font-semibold ' + sourceCls}>
                    {sourceLabel}
                </span>
            </td>
            <td>
                {editing ? (
                    <div className="flex items-center gap-2">
                        <select
                            value={agentId}
                            onChange={(e) => setAgentId(e.target.value === '' ? '' : Number(e.target.value))}
                            className="text-[12px] bg-white border border-ink-200 rounded-md px-2 py-1"
                        >
                            <option value="">— pick agent —</option>
                            {agents.map((a) => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                        </select>
                        <button
                            onClick={save}
                            disabled={agentId === '' || agentId === lead.agent.id}
                            className="px-2 py-1 text-[11px] bg-brand-500 text-white rounded font-semibold disabled:opacity-40"
                        >
                            Save
                        </button>
                        <button onClick={() => setEditing(false)} className="text-[11px] text-ink-500">
                            Cancel
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                            style={{ background: gradientForAgent(lead.agent.id) }}
                        >
                            {lead.agent.initials || '?'}
                        </div>
                        <span className="text-[12px]">{lead.agent.name ?? '—'}</span>
                        {lead.allocation_method === 'round_robin' && (
                            <span className="text-[9px] bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded font-bold">AUTO</span>
                        )}
                        {lead.allocation_method === 'manual' && (
                            <span className="text-[9px] bg-ink-100 text-ink-700 px-1.5 py-0.5 rounded font-bold">MANUAL</span>
                        )}
                        <button onClick={() => setEditing(true)} className="text-[11px] text-brand-600 hover:underline">
                            ⋯
                        </button>
                    </div>
                )}
            </td>
            <td>
                <span className={'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ' + statusCls}>
                    {lead.status}
                </span>
            </td>
            <td className="text-right pr-5 text-[11px] text-ink-500 font-mono">{lead.created_at ?? '—'}</td>
        </tr>
    );
}
