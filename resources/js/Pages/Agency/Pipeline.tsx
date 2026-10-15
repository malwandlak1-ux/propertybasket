import { useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import AgencyLayout from '@/Layouts/AgencyLayout';
import { FlashBanners, PageHeader, SummaryStrip, selectCls } from '@/Components/Dashboard/Charts';

type Card = {
    id: number;
    visitor_name: string;
    listing_title: string | null;
    listing_slug: string | null;
    listing_type: 'for_sale' | 'long_term_rent' | 'short_term_stay' | null;
    deal_value: number;
    agent: { id: number | null; name: string | null; initials: string };
    is_hot: boolean;
    status: string;
    can_register: boolean;
};
type Column = {
    key: 'new' | 'qualified' | 'viewing' | 'offer' | 'closed' | 'registered';
    label: string;
    dot: string;
    count: number;
    total_value: number;
    cards: Card[];
};

type SharedProps = { flash?: { success?: string | null; error?: string | null } };
type Props = {
    agency: { id: number; name: string };
    columns: Column[];
    total_pipeline_value: number;
    agents: { id: number; name: string }[];
    filters: { agent_id: number | null; deal_type: 'all' | 'sale' | 'rental' };
};

function fmtMoney(n: number): string {
    if (n >= 1_000_000) return 'R ' + (n / 1_000_000).toFixed(1) + 'm';
    if (n >= 1_000) return 'R ' + Math.round(n / 1_000) + 'k';
    return 'R ' + Math.round(n).toLocaleString('en-ZA');
}

function gradientForAgent(id: number | null): string {
    const palette = [
        'linear-gradient(135deg,var(--color-brand-500),var(--color-brand-700))',
        'linear-gradient(135deg,#F472B6,#E11D48)',
        'linear-gradient(135deg,#38BDF8,#0284C7)',
        'linear-gradient(135deg,#34D399,#059669)',
        'linear-gradient(135deg,#FBBF24,#D97706)',
        'linear-gradient(135deg,#A78BFA,#7C3AED)',
    ];
    return palette[(id ?? 0) % palette.length];
}

export default function Pipeline({ agency, columns, total_pipeline_value, agents, filters }: Props) {
    const { flash } = usePage<SharedProps>().props;
    const [registering, setRegistering] = useState<number | null>(null);

    const stage = (k: Column['key']) => columns.find((c) => c.key === k);
    const openCount = columns.filter((c) => ['new', 'qualified', 'viewing', 'offer'].includes(c.key)).reduce((n, c) => n + c.count, 0);
    const won = (stage('closed')?.count ?? 0) + (stage('registered')?.count ?? 0);
    const totalDeals = columns.reduce((n, c) => n + c.count, 0);
    const winRate = totalDeals > 0 ? Math.round((won / totalDeals) * 100) : 0;

    function registerDeal(card: Card) {
        if (registering !== null) return;
        if (! confirm(`Register "${card.visitor_name}" (${card.listing_title ?? 'deal'})? This finalises the deal and generates ${card.agent.name ?? 'the agent'}'s commission into the payout queue.`)) return;
        setRegistering(card.id);
        router.post(`/agency/pipeline/leads/${card.id}/register`, {}, {
            preserveScroll: true,
            onFinish: () => setRegistering(null),
        });
    }

    function setFilter(key: 'agent_id' | 'deal_type', value: string) {
        const next: Record<string, string> = {
            agent_id: filters.agent_id ? String(filters.agent_id) : '',
            deal_type: filters.deal_type ?? 'all',
        };
        next[key] = value;
        // Strip empties to keep URLs clean
        const payload: Record<string, string> = {};
        Object.entries(next).forEach(([k, v]) => {
            if (v && v !== '' && !(k === 'deal_type' && v === 'all')) payload[k] = v;
        });
        router.get('/agency/pipeline', payload, { preserveState: true, preserveScroll: true });
    }

    return (
        <AgencyLayout agencyName={agency.name} crumb="Pipeline">
            <Head title="Pipeline" />
            <section className="px-4 sm:px-7 py-6">
                <PageHeader
                    title="Agency Pipeline"
                    subtitle={<>All deals across all agents · {fmtMoney(total_pipeline_value)} total pipeline value</>}
                    actions={<>
                        <select
                            aria-label="Agent"
                            value={filters.agent_id ?? ''}
                            onChange={(e) => setFilter('agent_id', e.target.value)}
                            className={selectCls}
                        >
                            <option value="">All agents</option>
                            {agents.map((a) => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                        </select>
                        <select
                            aria-label="Deal type"
                            value={filters.deal_type}
                            onChange={(e) => setFilter('deal_type', e.target.value)}
                            className={selectCls}
                        >
                            <option value="all">All types</option>
                            <option value="sale">Sales only</option>
                            <option value="rental">Rentals only</option>
                        </select>
                    </>}
                />

                <FlashBanners flash={flash} />

                <SummaryStrip
                    title="Pipeline Summary"
                    subtitle={filters.agent_id ? `${agents.find((a) => a.id === filters.agent_id)?.name ?? 'Agent'} · current filters` : 'All agents · current filters'}
                    cells={[
                        { label: 'Pipeline Value', value: fmtMoney(total_pipeline_value), sub: `${openCount} open deal${openCount === 1 ? '' : 's'}` },
                        { label: 'In Offer', value: fmtMoney(stage('offer')?.total_value ?? 0), sub: `${stage('offer')?.count ?? 0} offer${(stage('offer')?.count ?? 0) === 1 ? '' : 's'} on the table`, tone: 'muted' },
                        { label: 'Closed (to register)', value: String(stage('closed')?.count ?? 0), sub: fmtMoney(stage('closed')?.total_value ?? 0), tone: (stage('closed')?.count ?? 0) > 0 ? 'warning' : 'muted' },
                        { label: 'Registered', value: fmtMoney(stage('registered')?.total_value ?? 0), sub: `${stage('registered')?.count ?? 0} deal${(stage('registered')?.count ?? 0) === 1 ? '' : 's'} · ${winRate}% win rate`, tone: 'success' },
                    ]}
                />

                <div className="flex gap-3 overflow-x-auto pb-2 min-h-[600px] snap-x lg:grid lg:grid-cols-6 lg:overflow-visible">
                    {columns.map((col) => (
                        <div key={col.key} className="bg-white/60 border border-ink-200/60 rounded-2xl p-3 shrink-0 snap-start w-[82vw] sm:w-[300px] lg:w-auto lg:shrink">
                            <div className="flex items-center justify-between mb-3 px-1">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                                    <p className="text-[11px] font-semibold uppercase tracking-wider">{col.label}</p>
                                    <span className="text-[11px] bg-ink-100 px-1.5 py-0.5 rounded-full font-bold">{col.count}</span>
                                </div>
                                <span className="text-[11px] text-ink-500 tabular-nums">{fmtMoney(col.total_value)}</span>
                            </div>

                            <div className="space-y-2">
                                {col.cards.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-ink-200 p-5 text-center text-[11.5px] text-ink-400">No leads here yet</div>
                                ) : (
                                    col.cards.map((c) => (
                                        <PipelineCard
                                            key={c.id}
                                            card={c}
                                            closed={col.key === 'closed'}
                                            registered={col.key === 'registered'}
                                            onRegister={c.can_register ? () => registerDeal(c) : undefined}
                                            busy={registering === c.id}
                                        />
                                    ))
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </AgencyLayout>
    );
}

function PipelineCard({ card, closed, registered = false, onRegister, busy = false }: { card: Card; closed: boolean; registered?: boolean; onRegister?: () => void; busy?: boolean }) {
    const isHot = card.is_hot;
    return (
        <div
            className={
                'bg-white rounded-xl p-3.5 shadow-soft border border-ink-200/70 ' +
                (closed ? 'border-success/30 bg-success/5 ' : '') +
                (registered ? 'border-violet-300 bg-violet-50/40 ' : '') +
                (isHot ? 'border-l-2 border-l-danger ' : '')
            }
        >
            <div className="flex items-center gap-2 mb-1">
                <p className="text-[13px] font-semibold flex-1 truncate">{card.visitor_name}</p>
                {isHot && (
                    <span className="text-[9px] bg-danger/15 text-danger px-1 rounded font-bold">HOT</span>
                )}
                {closed && (
                    <svg className="w-3 h-3 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path d="M5 13l4 4L19 7" />
                    </svg>
                )}
            </div>
            <p className="text-[11px] text-ink-500 mb-2 truncate">{card.listing_title ?? '—'}</p>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                    <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold shrink-0"
                        style={{ background: gradientForAgent(card.agent.id) }}
                    >
                        {card.agent.initials || '?'}
                    </div>
                    <span className="text-[10px] text-ink-500 truncate">{card.agent.name ?? '—'}</span>
                </div>
                <span className={'text-[11.5px] tabular-nums font-semibold ' + (closed ? 'text-success' : 'text-ink-900')}>
                    {fmtMoney(card.deal_value)}
                </span>
            </div>

            {onRegister && (
                <button
                    onClick={onRegister}
                    disabled={busy}
                    className="mt-2.5 w-full text-[11.5px] font-semibold px-2 py-1.5 bg-brand-700 text-white rounded-full hover:bg-brand-800 disabled:opacity-50 transition inline-flex items-center justify-center gap-1"
                >
                    {busy ? 'Registering…' : 'Register deal →'}
                </button>
            )}
            {registered && (
                <p className="mt-2.5 text-[10px] text-violet-700 font-semibold inline-flex items-center gap-1">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M5 13l4 4L19 7" /></svg>
                    Registered · commission queued
                </p>
            )}
        </div>
    );
}
